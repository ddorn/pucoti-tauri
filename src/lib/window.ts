import { getCurrentWindow, primaryMonitor, currentMonitor } from '@tauri-apps/api/window'
import { LogicalSize, LogicalPosition } from '@tauri-apps/api/dpi'
import { Command } from '@tauri-apps/plugin-shell'
import type { Settings } from './settings'

export type Corner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

/**
 * Platform-agnostic window management interface
 * Each platform (Sway, Hyprland, generic Tauri, etc.) implements this interface
 */
interface WindowPlatform {
  setCornerMode(settings: Settings): Promise<void>;
  setNormalMode(settings: Settings): Promise<void>;
  getDisplaySize(): Promise<{ width: number; height: number; }>;
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
 * Used for macOS, Windows, and Linux window managers other than Sway
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
 *   - 'border none' = no title bar, no edge
 *   - 'border normal' = Sway's title bar + border edge
 * - Tauri also renders its own client-side title bar independently
 * - To avoid double title bars, we disable Tauri decorations and let Sway handle everything
 */
class SwayPlatform implements WindowPlatform {
  async setCornerMode(settings: Settings): Promise<void> {
    const { smallWindowWidth, smallWindowHeight, smallWindowBorderless,
      cornerMarginTop, cornerMarginRight, cornerMarginBottom, cornerMarginLeft, corner } = settings;

    const workspace = await this.getDisplaySize();
    const positions = calculateCornerPositions(workspace, smallWindowWidth, smallWindowHeight, {
      cornerMarginTop, cornerMarginRight, cornerMarginBottom, cornerMarginLeft,
    });
    const pos = positions[corner];

    console.log('[window] Sway - Corner mode:', corner, 'position:', pos, 'size:', smallWindowWidth + 'x' + smallWindowHeight)

    // 'border none/normal' controls Sway's native decorations (title bar + edge)
    // smallWindowBorderless setting controls Sway's 'border' command
    // Use 'move position' (relative to workspace) which naturally handles swaybar and multi-monitor
    const command = [
      'fullscreen disable',
      'floating enable',
      `border ${smallWindowBorderless ? 'none' : 'normal'}`,
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
 * Platform detection and management
 */
let currentPlatform: WindowPlatform | null = null;

/**
 * Detect if running under Sway window manager
 * Checks for $SWAYSOCK which Sway always sets to its IPC socket path
 */
async function detectSway(): Promise<boolean> {
  try {
    const cmd = Command.create('run-sh', ['-c', 'echo $SWAYSOCK']);
    const result = await cmd.execute();
    const swaysock = result.stdout.trim();
    console.log('[window] Sway detection - SWAYSOCK:', swaysock);
    const isSway = swaysock.length > 0;
    console.log('[window] Running under Sway:', isSway);
    return isSway;
  } catch (err) {
    console.error('[window] Sway detection failed:', err);
    return false;
  }
}

/**
 * Get the appropriate platform implementation (cached after first detection)
 */
async function getPlatform(): Promise<WindowPlatform> {
  if (currentPlatform) return currentPlatform;

  // Detect platform
  if (await detectSway()) {
    console.log('[window] Using Sway platform');
    currentPlatform = new SwayPlatform();
  } else {
    console.log('[window] Using default platform');
    currentPlatform = new DefaultPlatform();
  }

  return currentPlatform;
}

/**
 * Set window to small corner mode
 *
 * Window Decorations Architecture:
 *
 * On Sway:
 * - Tauri's client-side decorations are ALWAYS disabled (setDecorations(false))
 * - Sway manages native window decorations via 'border' command:
 *   - 'border none' = no title bar, no border edge
 *   - 'border normal' = Sway's native title bar + border edge
 * - smallWindowBorderless setting controls Sway's 'border' command only
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
 * Initialize window decorations based on platform
 * Called at app startup to ensure correct decoration state
 */
export async function initializeWindowForPlatform(): Promise<void> {
  if (await detectSway()) {
    // On Sway, always disable Tauri's client-side decorations
    // Sway handles decorations natively via 'border' command
    const window = getCurrentWindow();
    await window.setDecorations(false);
    console.log('[window] Disabled Tauri decorations for Sway');
  }
}

/**
 * Cycle through corners
 */
export function nextCorner(current: Corner): Corner {
  const corners: Corner[] = ['bottom-right', 'bottom-left', 'top-left', 'top-right']
  const idx = corners.indexOf(current)
  return corners[(idx + 1) % corners.length]
}
