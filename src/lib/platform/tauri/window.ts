import { getCurrentWindow, primaryMonitor, currentMonitor } from '@tauri-apps/api/window'
import { LogicalSize, LogicalPosition } from '@tauri-apps/api/dpi'
import { Command, type Child } from '@tauri-apps/plugin-shell'
import { invoke } from '@tauri-apps/api/core'
import type { Settings } from '../../settings-types'
import type { Corner } from '../../corner'

/**
 * Platform-agnostic window management interface
 * Each platform (Sway, niri, generic Tauri, etc.) implements this interface
 */
interface WindowPlatform {
  setCornerMode(settings: Settings): Promise<void>;
  setNormalMode(settings: Settings): Promise<void>;
  getDisplaySize(): Promise<{ width: number; height: number; }>;
  /** Called once at app startup to set up platform-specific window state */
  initialize?(): Promise<void>;
}

/**
 * Calculate corner positions for a window given dimensions and margins
 */
function calculateCornerPositions(
  display: { width: number; height: number; },
  width: number,
  height: number,
  margins: { cornerMarginTop: number; cornerMarginRight: number; cornerMarginBottom: number; cornerMarginLeft: number; }
): Record<Corner, { x: number; y: number; }> {
  const { cornerMarginTop, cornerMarginRight, cornerMarginBottom, cornerMarginLeft } = margins;
  return {
    'bottom-right': { x: display.width - width - cornerMarginRight, y: display.height - height - cornerMarginBottom },
    'bottom-left': { x: cornerMarginLeft, y: display.height - height - cornerMarginBottom },
    'top-right': { x: display.width - width - cornerMarginRight, y: cornerMarginTop },
    'top-left': { x: cornerMarginLeft, y: cornerMarginTop },
  };
}

/**
 * Default platform implementation using Tauri window APIs
 * Used for macOS, Windows, and Linux window managers without a dedicated implementation
 */
class DefaultPlatform implements WindowPlatform {
  async setCornerMode(settings: Settings): Promise<void> {
    const { smallWindowWidth, smallWindowHeight, smallWindowBorderless,
      cornerMarginTop, cornerMarginRight, cornerMarginBottom, cornerMarginLeft, corner } = settings;

    const display = await this.getDisplaySize();
    const positions = calculateCornerPositions(display, smallWindowWidth, smallWindowHeight, {
      cornerMarginTop, cornerMarginRight, cornerMarginBottom, cornerMarginLeft,
    });
    const pos = positions[corner];

    console.log('[window] Default platform - Corner mode:', corner, 'position:', pos, 'size:', smallWindowWidth + 'x' + smallWindowHeight);

    const window = getCurrentWindow();
    // smallWindowBorderless controls Tauri's client-side decorations
    await window.setDecorations(!smallWindowBorderless);
    await window.setAlwaysOnTop(true);
    await window.setSize(new LogicalSize(smallWindowWidth, smallWindowHeight));
    await window.setPosition(new LogicalPosition(pos.x, pos.y));
  }

  async setNormalMode(settings: Settings): Promise<void> {
    const { normalWindowWidth, normalWindowHeight } = settings;

    console.log('[window] Default platform - Normal mode:', normalWindowWidth + 'x' + normalWindowHeight);

    const window = getCurrentWindow()
    // Always show decorations in normal mode
    await window.setDecorations(true);
    await window.setAlwaysOnTop(false);
    await window.setSize(new LogicalSize(normalWindowWidth, normalWindowHeight));
    await window.center()
  }

  async getDisplaySize(): Promise<{ width: number; height: number; }> {
    // Try to get current window's monitor, fallback to primary monitor
    try {
      const monitor = await currentMonitor();
      if (monitor) {
        console.log('[window] Current monitor:', monitor);
        const size = monitor.size;
        return { width: size.width, height: size.height };
      }

      // Fallback to primary monitor
      const primaryMon = await primaryMonitor();
      if (primaryMon) {
        console.log('[window] Primary monitor (fallback):', primaryMon);
        const size = primaryMon.size;
        return { width: size.width, height: size.height };
      }
    } catch (err) {
      console.error('[window] Failed to get monitor info:', err);
    }

    const fallback = { width: 1920, height: 1080 };
    console.warn('[window] Using fallback display size:', fallback.width + 'x' + fallback.height);
    return fallback;
  }
}

/**
 * Sway window manager platform implementation
 * Uses swaymsg commands for precise multi-monitor positioning and native decorations
 *
 * Decorations on Sway:
 * - Sway manages native window decorations (title bar + border edge) via 'border' command
 * - Tauri also renders its own client-side title bar independently
 * - To avoid double title bars, we disable Tauri decorations and let Sway handle everything
 */
class SwayPlatform implements WindowPlatform {
  async setCornerMode(settings: Settings): Promise<void> {
    const { smallWindowWidth, smallWindowHeight,
      cornerMarginTop, cornerMarginRight, cornerMarginBottom, cornerMarginLeft, corner } = settings;

    const workspace = await this.getDisplaySize();
    const positions = calculateCornerPositions(workspace, smallWindowWidth, smallWindowHeight, {
      cornerMarginTop, cornerMarginRight, cornerMarginBottom, cornerMarginLeft,
    });
    const pos = positions[corner];

    console.log('[window] Sway - Corner mode:', corner, 'position:', pos, 'size:', smallWindowWidth + 'x' + smallWindowHeight)

    // 'border none/normal/pixel' controls Sway's native decorations (title bar + edge)
    // smallWindowBorderless setting controls Sway's 'border' command
    // Use 'move position' (relative to workspace) which naturally handles swaybar and multi-monitor
    const command = [
      'fullscreen disable',
      'floating enable',
      `border pixel`,
      `resize set ${smallWindowWidth} ${smallWindowHeight}`,
      `move position ${pos.x} ${pos.y}`,
      'sticky enable'
    ].join(', ')

    console.log('[window] Executing swaymsg:', command)
    const cmd = Command.create('run-swaymsg', [command])
    const result = await cmd.execute();
    console.log('[window] swaymsg result - code:', result.code, 'stdout:', result.stdout, 'stderr:', result.stderr);

    // On Sway: Always disable Tauri's client-side decorations
    // Sway handles all window decorations natively via 'border' command
    const window = getCurrentWindow();
    await window.setDecorations(false);
  }

  async setNormalMode(settings: Settings): Promise<void> {
    const { normalWindowWidth, normalWindowHeight } = settings;

    console.log('[window] Sway - Normal mode:', normalWindowWidth + 'x' + normalWindowHeight);

    // We don't explicitly set border here - leaving it to user's Sway config defaults
    // Use 'move position center' (not 'move absolute position') to center on current output
    const command = [
      `resize set ${normalWindowWidth} ${normalWindowHeight}`,
      'move position center'
    ].join(', ')

    console.log('[window] Executing swaymsg:', command);
    const cmd = Command.create('run-swaymsg', [command])
    const result = await cmd.execute();
    console.log('[window] swaymsg result - code:', result.code);

    // On Sway: Always disable Tauri's client-side decorations
    const window = getCurrentWindow();
    await window.setDecorations(false);
  }

  async initialize(): Promise<void> {
    // Sway handles decorations natively via 'border', so Tauri's must stay off
    const window = getCurrentWindow();
    await window.setDecorations(false);
    console.log('[window] Disabled Tauri decorations for Sway');
  }

  async getDisplaySize(): Promise<{ width: number; height: number; x: number; y: number; }> {
    // Use swaymsg to get workspace dimensions (usable area excluding swaybar)
    try {
      const cmd = Command.create('run-swaymsg', ['-t', 'get_workspaces']);
      const result = await cmd.execute();
      console.log('[window] swaymsg get_workspaces - code:', result.code);

      if (result.code === 0) {
        const workspaces = JSON.parse(result.stdout);

        // Find the focused workspace
        const focused = workspaces.find((w: { focused: boolean; }) => w.focused);
        if (focused?.rect) {
          console.log('[window] Workspace:', focused.rect.width + 'x' + focused.rect.height,
            'at offset (' + focused.rect.x + ', ' + focused.rect.y + ') (focused workspace)');
          return {
            width: focused.rect.width,
            height: focused.rect.height,
            x: focused.rect.x,
            y: focused.rect.y
          };
        }

        // Fallback to first visible workspace
        const visible = workspaces.find((w: { visible: boolean; }) => w.visible);
        if (visible?.rect) {
          console.log('[window] Workspace:', visible.rect.width + 'x' + visible.rect.height,
            'at offset (' + visible.rect.x + ', ' + visible.rect.y + ') (visible workspace)');
          return {
            width: visible.rect.width,
            height: visible.rect.height,
            x: visible.rect.x,
            y: visible.rect.y
          };
        }
      }
    } catch (err) {
      console.error('[window] swaymsg get_workspaces failed:', err);
    }

    // Fallback to default platform's method
    console.log('[window] Sway falling back to Tauri window API');
    const defaultPlatform = new DefaultPlatform();
    const size = await defaultPlatform.getDisplaySize();
    return { ...size, x: 0, y: 0 };
  }
}

/**
 * Process id of the app, asked once from the backend and cached
 */
let processId: number | null = null;

async function getProcessId(): Promise<number | null> {
  if (processId === null) {
    try {
      processId = await invoke<number>('process_id');
    } catch (err) {
      console.error('[window] Failed to get process id:', err);
      return null;
    }
  }
  return processId;
}

/**
 * A window as reported by `niri msg --json windows`
 * `tile_pos_in_workspace_view` is the window position relative to the output
 * (null when its workspace is not visible)
 */
interface NiriWindow {
  id: number;
  pid: number | null;
  workspace_id: number | null;
  is_floating: boolean;
  layout: {
    tile_size: [number, number];
    tile_pos_in_workspace_view: [number, number] | null;
  };
}

/**
 * A workspace as reported by `niri msg --json workspaces`
 */
interface NiriWorkspace {
  id: number;
  idx: number;
  name: string | null;
  output: string | null;
}

/**
 * niri window manager platform implementation
 * Uses `niri msg action` for floating placement. Every action targets our own
 * window by id, so a mode switch never moves whichever window happens to be
 * focused - if our window cannot be found, the mode switch is skipped.
 *
 * Coordinates: `move-floating-window` positions a window relative to the *working
 * area* of its output (what is left after bars take their exclusive zones), and
 * niri does not keep windows fully on screen, so corner placement needs the
 * working area rather than the output size. niri exposes no working area over
 * IPC, so it is measured (see `measureWorkingArea`) and cached per output.
 *
 * Sticky: niri has no sticky windows, so the app follows the active workspace
 * itself while it is floating (see `startFollowingWorkspaces`).
 *
 * Decorations: Tauri's are always off, like on Sway. Keeping them adds a GTK
 * title bar on top of the border niri already draws, and floating windows are
 * moved and resized with the compositor's own bindings anyway.
 */
class NiriPlatform implements WindowPlatform {
  private workingArea: { output: string; width: number; height: number; } | null = null;
  /** Running `niri msg event-stream`, see `startFollowingWorkspaces` */
  private follower: Promise<Child> | null = null;

  private async run(args: string[]): Promise<string | null> {
    const cmd = Command.create('run-niri', args);
    const result = await cmd.execute();
    if (result.code !== 0) {
      console.error('[window] niri', args.join(' '), 'failed - code:', result.code, 'stderr:', result.stderr);
      return null;
    }
    return result.stdout;
  }

  private async action(args: string[], id: number): Promise<void> {
    console.log('[window] niri msg action', args.join(' '), '(id ' + id + ')');
    await this.run(['msg', 'action', ...args, '--id', String(id)]);
  }

  /**
   * Our own window, found by process id so that a second instance of the app is
   * never the one that gets moved. Null if niri does not know about it (yet).
   */
  private async getWindow(): Promise<NiriWindow | null> {
    const [stdout, pid] = await Promise.all([
      this.run(['msg', '--json', 'windows']),
      getProcessId(),
    ]);
    if (stdout === null || pid === null) return null;
    try {
      const windows: NiriWindow[] = JSON.parse(stdout);
      const own = windows.find((w) => w.pid === pid);
      if (!own) console.warn('[window] niri: no window for pid', pid);
      return own ?? null;
    } catch (err) {
      console.error('[window] niri: failed to parse windows:', err);
      return null;
    }
  }

  private async getWorkspaces(): Promise<NiriWorkspace[]> {
    const stdout = await this.run(['msg', '--json', 'workspaces']);
    if (stdout === null) return [];
    try {
      return JSON.parse(stdout);
    } catch (err) {
      console.error('[window] niri: failed to parse workspaces:', err);
      return [];
    }
  }

  /**
   * The output our window is on, null if it cannot be determined.
   *
   * Positions are per-output, so this has to follow the window rather than the
   * focus: the two differ whenever the user works on another monitor.
   */
  private async getOutput(win: NiriWindow): Promise<{ name: string; width: number; height: number; } | null> {
    const [workspaces, outputsJson] = await Promise.all([
      this.getWorkspaces(),
      this.run(['msg', '--json', 'outputs']),
    ]);
    if (outputsJson === null) return null;

    const name = workspaces.find((w) => w.id === win.workspace_id)?.output;
    if (!name) return null;

    try {
      const logical = JSON.parse(outputsJson)[name]?.logical;
      if (!logical) return null;
      return { name, width: logical.width, height: logical.height };
    } catch (err) {
      console.error('[window] niri: failed to parse outputs:', err);
      return null;
    }
  }

  /**
   * Resize our window and wait until niri reports the new size.
   *
   * Resizes go through the client, so for a frame or two niri still reports the
   * old size - centering or measuring before the new size lands is off by half
   * the difference.
   */
  private async resize(id: number, width: number, height: number): Promise<NiriWindow | null> {
    await this.action(['set-window-width', String(width)], id);
    await this.action(['set-window-height', String(height)], id);

    for (let attempt = 0; attempt < 20; attempt++) {
      const own = await this.getWindow();
      if (!own) return null;
      const [w, h] = own.layout.tile_size;
      if (Math.abs(w - width) <= 1 && Math.abs(h - height) <= 1) return own;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    console.warn('[window] niri: window never reached', width + 'x' + height, '(size constraints?)');
    return this.getWindow();
  }

  /**
   * Measure the working area of the output our (floating) window is on.
   *
   * niri has no IPC for the working area, but it does report window positions
   * relative to the output, so we read our window at two known spots: at the
   * working area origin (0, 0) and centered. The centered position is
   * `origin + (area - size) / 2`, which gives the area size.
   *
   * The window must already be floating, and it visibly moves - callers place it
   * at its final position right after.
   */
  private async measureWorkingArea(id: number): Promise<{ width: number; height: number; } | null> {
    await this.action(['move-floating-window', '-x', '0', '-y', '0'], id);
    const atOrigin = (await this.getWindow())?.layout.tile_pos_in_workspace_view;

    await this.action(['center-window'], id);
    const centered = await this.getWindow();
    const atCenter = centered?.layout.tile_pos_in_workspace_view;

    if (!atOrigin || !atCenter || !centered) {
      console.warn('[window] niri: could not measure working area (window position unknown)');
      return null;
    }

    const [width, height] = centered.layout.tile_size;
    return {
      width: 2 * (atCenter[0] - atOrigin[0]) + width,
      height: 2 * (atCenter[1] - atOrigin[1]) + height,
    };
  }

  /**
   * Working area of the current output, measured once per output and cached.
   * Falls back to the output size (bars not excluded) if measuring fails.
   */
  private async getWorkingArea(win: NiriWindow): Promise<{ width: number; height: number; }> {
    const output = await this.getOutput(win);
    if (this.workingArea && this.workingArea.output === output?.name) {
      return this.workingArea;
    }

    const measured = await this.measureWorkingArea(win.id);
    if (measured && output) {
      // Positions are reported rounded to physical pixels, and the measurement
      // doubles that error, so keep it within the output it is part of
      const area = {
        width: Math.min(measured.width, output.width),
        height: Math.min(measured.height, output.height),
      };
      console.log('[window] niri working area on', output.name, ':', area.width + 'x' + area.height);
      this.workingArea = { output: output.name, ...area };
      return area;
    }

    console.warn('[window] niri: falling back to the output size, bars are not excluded');
    return output ?? this.getDisplaySize();
  }

  async setCornerMode(settings: Settings): Promise<void> {
    const { smallWindowWidth, smallWindowHeight,
      cornerMarginTop, cornerMarginRight, cornerMarginBottom, cornerMarginLeft, corner } = settings;

    const own = await this.getWindow();
    if (!own) {
      console.error('[window] niri: skipping corner mode, own window not found');
      return;
    }
    const id = own.id;

    // Size first: the working area is measured from where the window lands, so
    // it has to be measured at the size we are about to place
    await this.action(['move-window-to-floating'], id);
    await this.resize(id, smallWindowWidth, smallWindowHeight);

    const area = await this.getWorkingArea(own);
    const positions = calculateCornerPositions(area, smallWindowWidth, smallWindowHeight, {
      cornerMarginTop, cornerMarginRight, cornerMarginBottom, cornerMarginLeft,
    });
    const pos = positions[corner];

    console.log('[window] niri - Corner mode:', corner, 'position:', pos, 'size:', smallWindowWidth + 'x' + smallWindowHeight);

    // Unsigned values set an absolute position (a leading +/- would be relative)
    await this.action(['move-floating-window', '-x', String(Math.round(pos.x)), '-y', String(Math.round(pos.y))], id);
  }

  async setNormalMode(settings: Settings): Promise<void> {
    const { normalWindowWidth, normalWindowHeight } = settings;

    console.log('[window] niri - Normal mode:', normalWindowWidth + 'x' + normalWindowHeight);

    // Leave the window in whichever layout it is in: resizing and centering work
    // for both floating and tiled windows
    const id = (await this.getWindow())?.id;
    if (id === undefined) {
      console.error('[window] niri: skipping normal mode, own window not found');
      return;
    }

    await this.resize(id, normalWindowWidth, normalWindowHeight);
    await this.action(['center-window'], id);
  }

  async initialize(): Promise<void> {
    const window = getCurrentWindow();
    await window.setDecorations(false);
    console.log('[window] Disabled Tauri decorations for niri');

    await this.startFollowingWorkspaces();
  }

  /**
   * Keep the window on the workspace the user is looking at.
   *
   * niri has no sticky windows, so we follow its event stream and move our
   * window along whenever another workspace becomes active. Only workspaces on
   * the output the window is already on count: with several screens, the window
   * stays on its screen and follows that screen's switches.
   *
   * This runs for as long as the app does, in every display mode - what decides
   * whether the window follows is whether it is floating, which is checked per
   * event. The `niri msg event-stream` child is torn down with the app, so it
   * never needs stopping.
   */
  private async startFollowingWorkspaces(): Promise<void> {
    if (this.follower) return;

    const command = Command.create('run-niri', ['msg', '--json', 'event-stream']);
    command.stdout.on('data', (line) => void this.onWorkspaceActivated(line));
    command.on('close', () => {
      this.follower = null;
      console.warn('[window] niri event stream closed, no longer following workspaces');
    });
    command.on('error', (err) => console.error('[window] niri event stream failed:', err));

    // Assigned before awaiting: a second caller must see it, or we end up with
    // two streams
    this.follower = command.spawn();
    try {
      await this.follower;
      console.log('[window] niri: following workspace switches');
    } catch (err) {
      this.follower = null;
      console.error('[window] niri: could not follow workspace switches:', err);
    }
  }

  /**
   * Move our window to a workspace that just became active, if it should follow
   */
  private async onWorkspaceActivated(line: string): Promise<void> {
    let activated: { id: number; } | undefined;
    try {
      activated = JSON.parse(line)?.WorkspaceActivated;
    } catch {
      return; // Some other event, or a partial line
    }
    if (!activated) return;

    const own = await this.getWindow();
    // Only a floating window follows: tiling it is how the user pins it to a
    // single workspace
    if (!own || !own.is_floating) return;

    const workspaces = await this.getWorkspaces();
    const target = workspaces.find((w) => w.id === activated.id);
    const current = workspaces.find((w) => w.id === own.workspace_id);
    if (!target || !current || target.id === current.id) return;
    if (target.output !== current.output) return; // Another screen switched

    // A workspace reference is a name or an index. Names only exist for named
    // workspaces, so fall back to the index, which niri resolves on the output
    // the window is on - the output we just checked the target is on too.
    const reference = target.name || String(target.idx);
    await this.run(['msg', 'action', 'move-window-to-workspace',
      '--window-id', String(own.id), '--focus', 'false', reference]);
  }

  /**
   * Size of the output our window is on. This is the full output, bars included -
   * `getWorkingArea` is what corner placement uses.
   */
  async getDisplaySize(): Promise<{ width: number; height: number; }> {
    const stdout = await this.run(['msg', '--json', 'focused-output']);
    if (stdout !== null) {
      try {
        const logical = JSON.parse(stdout)?.logical;
        if (logical) return { width: logical.width, height: logical.height };
      } catch (err) {
        console.error('[window] niri: failed to parse focused-output:', err);
      }
    }

    console.log('[window] niri falling back to Tauri window API');
    return new DefaultPlatform().getDisplaySize();
  }
}

/**
 * Platform detection and management
 *
 * The detection, not its result, is what gets cached: it is asynchronous, and
 * callers that overlap have to end up with the same platform instance - a second
 * one would duplicate everything it owns, such as niri's event stream.
 */
let currentPlatform: Promise<WindowPlatform> | null = null;

/**
 * Read an environment variable of the running app, empty string if unset
 * Compositors advertise themselves this way: Sway sets $SWAYSOCK and niri sets
 * $NIRI_SOCKET to their IPC socket path
 */
async function readEnv(name: string): Promise<string> {
  try {
    const cmd = Command.create('run-sh', ['-c', `printf %s "$${name}"`]);
    const result = await cmd.execute();
    return result.stdout.trim();
  } catch (err) {
    console.error(`[window] Failed to read $${name}:`, err);
    return '';
  }
}

/**
 * Get the appropriate platform implementation (detected once)
 */
function getPlatform(): Promise<WindowPlatform> {
  if (!currentPlatform) currentPlatform = detectPlatform();
  return currentPlatform;
}

async function detectPlatform(): Promise<WindowPlatform> {
  if (await readEnv('SWAYSOCK')) {
    console.log('[window] Using Sway platform');
    return new SwayPlatform();
  } else if (await readEnv('NIRI_SOCKET')) {
    console.log('[window] Using niri platform');
    return new NiriPlatform();
  } else {
    console.log('[window] Using default platform');
    return new DefaultPlatform();
  }
}

/**
 * Set window to small corner mode
 *
 * Window Decorations Architecture:
 *
 * On Sway:
 * - Tauri's client-side decorations are ALWAYS disabled (setDecorations(false))
 * - Sway manages native window decorations via 'border' command:
 * - smallWindowBorderless setting controls Sway's 'border' command only
 *
 * On niri:
 * - Tauri's client-side decorations are ALWAYS disabled, in both modes: they add
 *   a GTK title bar on top of the border niri draws itself
 * - smallWindowBorderless has no effect
 *
 * On other platforms (macOS, Windows, other Linux WMs):
 * - Tauri renders client-side decorations (title bar with buttons)
 * - smallWindowBorderless setting controls Tauri's setDecorations():
 *   - true = no Tauri decorations (borderless window)
 *   - false = show Tauri decorations (title bar with buttons)
 * - Normal mode always shows decorations (setDecorations(true))
 */
export async function setSmallMode(settings: Settings): Promise<void> {
  // Exit fullscreen if active (common to all platforms)
  try {
    const window = getCurrentWindow()
    const isFs = await window.isFullscreen()
    if (isFs) {
      await window.setFullscreen(false)
    }
  } catch (err) {
    console.error('[window] Fullscreen check/exit failed (may not be supported on this platform):', err)
  }

  const platform = await getPlatform();
  await platform.setCornerMode(settings);
}

/**
 * Set window to normal mode
 */
export async function setNormalMode(
  settings: Settings
): Promise<void> {
  const platform = await getPlatform();
  await platform.setNormalMode(settings);
}

/**
 * Logical size of the monitor the window is currently on (physical size divided
 * by the monitor's scale factor, matching the LogicalSize used for window sizing).
 * Used to cap window resizing so the window never exceeds the screen. Returns
 * null if monitor info is unavailable.
 */
export async function getMaxWindowSize(): Promise<{ width: number; height: number } | null> {
  try {
    const monitor = (await currentMonitor()) ?? (await primaryMonitor())
    if (!monitor) return null
    const scale = monitor.scaleFactor || 1
    return {
      width: Math.floor(monitor.size.width / scale),
      height: Math.floor(monitor.size.height / scale),
    }
  } catch (err) {
    console.error('[window] Failed to get monitor size:', err)
    return null
  }
}

/**
 * Initialize window decorations based on platform
 * Called at app startup to ensure correct decoration state
 */
export async function initializeWindowForPlatform(): Promise<void> {
  const platform = await getPlatform();
  await platform.initialize?.();
}

