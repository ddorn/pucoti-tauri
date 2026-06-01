import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Shell from 'gi://Shell';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

const DBUS_NAME = 'org.pucoti.Timer';
const DBUS_PATH = '/org/pucoti/Timer';
const DBUS_INTERFACE = 'org.pucoti.Timer';
const POLL_INTERVAL_MS = 500;
const MAX_FOCUS_LENGTH = 20;

const WINDOW_DBUS_NAME = 'org.pucoti.Window';
const WINDOW_DBUS_PATH = '/org/pucoti/Window';
const WINDOW_DBUS_XML = `
<node>
  <interface name="org.pucoti.Window">
    <method name="MoveResize">
      <arg type="i" direction="in" name="x"/>
      <arg type="i" direction="in" name="y"/>
      <arg type="i" direction="in" name="width"/>
      <arg type="i" direction="in" name="height"/>
    </method>
    <method name="MakeAbove">
      <arg type="b" direction="in" name="above"/>
    </method>
    <method name="Stick">
      <arg type="b" direction="in" name="stick"/>
    </method>
  </interface>
</node>`;

export default class PucotiExtension extends Extension {
    _indicator = null;
    _label = null;
    _pollTimeoutId = null;
    _dbusProxy = null;
    _dbusWatchId = null;
    _serviceAvailable = false;
    _windowDbusId = null;
    _windowDbusImpl = null;

    enable() {
        // Create the panel indicator (button)
        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);

        // Create the label
        this._label = new St.Label({
            text: '',
            y_align: imports.gi.Clutter.ActorAlign.CENTER,
            style_class: 'pucoti-label',
        });
        this._indicator.add_child(this._label);

        // Add click handler to focus Pucoti window
        this._indicator.connect('button-press-event', () => {
            this._focusPucotiWindow();
            return imports.gi.Clutter.EVENT_STOP;
        });

        // Hide initially until we get data
        this._indicator.visible = false;

        // Add to panel (left of system indicators)
        Main.panel.addToStatusArea(this.uuid, this._indicator, 0, 'right');

        // Own a D-Bus name to expose window management methods
        this._windowDbusId = Gio.bus_own_name(
            Gio.BusType.SESSION,
            WINDOW_DBUS_NAME,
            Gio.BusNameOwnerFlags.NONE,
            (_connection, _name) => {
                this._windowDbusImpl = Gio.DBusExportedObject.wrapJSObject(WINDOW_DBUS_XML, this);
                this._windowDbusImpl.export(Gio.DBus.session, WINDOW_DBUS_PATH);
            },
            null,
            null
        );

        // Watch for the D-Bus service to appear/disappear
        this._dbusWatchId = Gio.bus_watch_name(
            Gio.BusType.SESSION,
            DBUS_NAME,
            Gio.BusNameWatcherFlags.NONE,
            this._onServiceAppeared.bind(this),
            this._onServiceVanished.bind(this)
        );
    }

    disable() {
        // Unexport window D-Bus interface and release name
        if (this._windowDbusImpl) {
            this._windowDbusImpl.unexport();
            this._windowDbusImpl = null;
        }
        if (this._windowDbusId) {
            Gio.bus_unown_name(this._windowDbusId);
            this._windowDbusId = null;
        }

        // Stop watching D-Bus name
        if (this._dbusWatchId) {
            Gio.bus_unwatch_name(this._dbusWatchId);
            this._dbusWatchId = null;
        }

        // Stop polling
        this._stopPolling();

        // Destroy indicator
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
            this._label = null;
        }

        this._dbusProxy = null;
    }

    _onServiceAppeared(_connection, name, _nameOwner) {
        console.log(`Pucoti: D-Bus service ${name} appeared`);
        this._serviceAvailable = true;
        this._createProxy();
    }

    _onServiceVanished(_connection, name) {
        console.log(`Pucoti: D-Bus service ${name} vanished`);
        this._serviceAvailable = false;
        this._stopPolling();
        this._dbusProxy = null;
        if (this._indicator) {
            this._indicator.visible = false;
        }
    }

    _createProxy() {
        const TimerProxyWrapper = Gio.DBusProxy.makeProxyWrapper(`
            <node>
                <interface name="${DBUS_INTERFACE}">
                    <method name="GetState">
                        <arg type="b" direction="out" name="running"/>
                        <arg type="i" direction="out" name="remaining_seconds"/>
                        <arg type="s" direction="out" name="focus_text"/>
                        <arg type="b" direction="out" name="is_overtime"/>
                    </method>
                    <property name="Running" type="b" access="read"/>
                    <property name="RemainingSeconds" type="i" access="read"/>
                    <property name="FocusText" type="s" access="read"/>
                    <property name="IsOvertime" type="b" access="read"/>
                </interface>
            </node>
        `);

        try {
            this._dbusProxy = new TimerProxyWrapper(
                Gio.DBus.session,
                DBUS_NAME,
                DBUS_PATH
            );
            this._startPolling();
        } catch (e) {
            console.error('Pucoti: Failed to create D-Bus proxy:', e);
        }
    }

    _startPolling() {
        if (this._pollTimeoutId) {
            return; // Already polling
        }

        this._pollTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, POLL_INTERVAL_MS, () => {
            this._pollTimerState();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopPolling() {
        if (this._pollTimeoutId) {
            GLib.source_remove(this._pollTimeoutId);
            this._pollTimeoutId = null;
        }
    }

    _pollTimerState() {
        if (!this._dbusProxy || !this._serviceAvailable) {
            return;
        }

        try {
            this._dbusProxy.GetStateRemote((result, error) => {
                if (error) {
                    console.error('Pucoti: D-Bus call failed:', error);
                    return;
                }

                const [running, remainingSeconds, focusText, isOvertime] = result;
                this._updateDisplay(running, remainingSeconds, focusText, isOvertime);
            });
        } catch (e) {
            console.error('Pucoti: Failed to poll timer state:', e);
        }
    }

    _updateDisplay(running, remainingSeconds, focusText, isOvertime) {
        if (!this._indicator || !this._label) {
            return;
        }

        if (!running) {
            this._indicator.visible = false;
            return;
        }

        // Format time as MM:SS or H:MM:SS when duration exceeds one hour
        const absSeconds = Math.abs(remainingSeconds);
        const hours = Math.floor(absSeconds / 3600);
        const minutes = Math.floor((absSeconds % 3600) / 60);
        const seconds = absSeconds % 60;
        const pad = (n) => n.toString().padStart(2, '0');
        const timeStr = hours > 0
            ? `${hours}:${pad(minutes)}:${pad(seconds)}`
            : `${minutes}:${pad(seconds)}`;


        // Truncate focus text if too long
        let displayFocus = focusText;
        if (displayFocus.length > MAX_FOCUS_LENGTH) {
            displayFocus = displayFocus.substring(0, MAX_FOCUS_LENGTH - 1) + '\u2026'; // ellipsis
        }

        // Build display text
        const displayText = displayFocus ? `${timeStr} \u00B7 ${displayFocus}` : timeStr;
        this._label.set_text(displayText);

        // Apply overtime styling
        if (isOvertime) {
            this._label.add_style_class_name('pucoti-overtime');
        } else {
            this._label.remove_style_class_name('pucoti-overtime');
        }

        this._indicator.visible = true;
    }

    _findPucotiMetaWindow() {
        for (const actor of global.get_window_actors()) {
            const mw = actor.get_meta_window();
            if (mw?.get_wm_class()?.toLowerCase().includes('pucoti')) return mw;
        }
        return null;
    }

    MoveResize(x, y, width, height) {
        const w = this._findPucotiMetaWindow();
        if (w) w.move_resize_frame(true, x, y, width, height);
    }

    MakeAbove(above) {
        const w = this._findPucotiMetaWindow();
        if (!w) return;
        above ? w.make_above() : w.unmake_above();
    }

    Stick(stick) {
        const w = this._findPucotiMetaWindow();
        if (!w) return;
        stick ? w.stick() : w.unstick();
    }

    _focusPucotiWindow() {
        const metaWindow = this._findPucotiMetaWindow();

        if (metaWindow) {
            // Found Pucoti window, activate it
            const workspace = metaWindow.get_workspace();
            const time = global.get_current_time();

            if (workspace) {
                workspace.activate_with_focus(metaWindow, time);
            } else {
                metaWindow.activate(time);
            }

            // Unminimize if minimized
            if (metaWindow.minimized) {
                metaWindow.unminimize();
            }

            return;
        }

        // Window not found, try to launch Pucoti
        console.log('Pucoti: Window not found, attempting to launch');
        try {
            GLib.spawn_command_line_async('pucoti');
        } catch (e) {
            console.error('Pucoti: Failed to launch:', e);
        }
    }
}
