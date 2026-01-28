import { getCurrentWindow, primaryMonitor, availableMonitors } from '@tauri-apps/api/window'
import { LogicalSize, LogicalPosition } from '@tauri-apps/api/dpi'
import { Command } from '@tauri-apps/plugin-shell'
import type { Settings } from './settings'

export type Corner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

/**
 * Platform-agnostic window management interface
 * Each platform (Sway, Hyprland, generic Tauri, etc.) implements this interface
 */
interface WindowPlatform {
  setCornerMode(corner: Corner, settings: Settings): Promise<void>;
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
  async setCornerMode(corner: Corner, settings: Settings): Promise<void> {
    const { smallWindowWidth, smallWindowHeight, smallWindowBorderless,
      cornerMarginTop, cornerMarginRight, cornerMarginBottom, cornerMarginLeft } = settings;

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
      const window = getCurrentWindow()
      const monitors = await availableMonitors();
      const windowPos = await window.outerPosition()

      if (monitors && monitors.length > 0) {
        // Find monitor containing the window
        const currentMonitor = monitors.find(m => {
          const pos = m.position;
          const size = m.size;
          return windowPos.x >= pos.x && windowPos.x < pos.x + size.width &&
            windowPos.y >= pos.y && windowPos.y < pos.y + size.height;
        }) || monitors[0]; // Fallback to first monitor if not found

        if (currentMonitor) {
          const size = currentMonitor.size
          console.log('[window] Display:', size.width + 'x' + size.height, '(current monitor)');
          return { width: size.width, height: size.height }
        }
      }

      // Fallback to primary monitor
      const monitor = await primaryMonitor();
      if (monitor) {
        const size = monitor.size
        console.log('[window] Display:', size.width + 'x' + size.height, '(primary monitor)');
        return { width: size.width, height: size.height }
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
  async setCornerMode(corner: Corner, settings: Settings): Promise<void> {
    const { smallWindowWidth, smallWindowHeight, smallWindowBorderless,
      cornerMarginTop, cornerMarginRight, cornerMarginBottom, cornerMarginLeft } = settings;

    const display = await this.getDisplaySize();
    const positions = calculateCornerPositions(display, smallWindowWidth, smallWindowHeight, {
      cornerMarginTop, cornerMarginRight, cornerMarginBottom, cornerMarginLeft,
    });
    const pos = positions[corner];

    console.log('[window] Sway - Corner mode:', corner, 'position:', pos, 'size:', smallWindowWidth + 'x' + smallWindowHeight)

    // 'border none/normal' controls Sway's native decorations (title bar + edge)
    // smallWindowBorderless setting controls Sway's 'border' command
    const command = [
      'floating enable',
      `border ${smallWindowBorderless ? 'none' : 'normal'}`,
      `resize set ${smallWindowWidth} ${smallWindowHeight}`,
      `move absolute position ${pos.x} ${pos.y}`,
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
    // Combine all commands into a single swaymsg call
    const command = [
      `resize set ${normalWindowWidth} ${normalWindowHeight}`,
      'move absolute position center'
    ].join(', ')

    const cmd = Command.create('run-swaymsg', [command])
    const result = await cmd.execute();
    console.log('[window] swaymsg result - code:', result.code);

    // On Sway: Always disable Tauri's client-side decorations
    const window = getCurrentWindow();
    await window.setDecorations(false);
  }

  async getDisplaySize(): Promise<{ width: number; height: number; }> {
    // Use swaymsg for accurate multi-monitor output info
    try {
      const cmd = Command.create('run-swaymsg', ['-t', 'get_outputs']);
      const result = await cmd.execute();
      console.log('[window] swaymsg get_outputs - code:', result.code);

      if (result.code === 0) {
        const outputs = JSON.parse(result.stdout);

        // Prefer focused output
        const focused = outputs.find((o: { focused: boolean; }) => o.focused);
        if (focused?.rect) {
          console.log('[window] Display:', focused.rect.width + 'x' + focused.rect.height, '(focused output)');
          return { width: focused.rect.width, height: focused.rect.height };
        }

        // Fallback: find output containing current window
        if (outputs.length > 0) {
          const window = getCurrentWindow();
          const windowPos = await window.outerPosition();
          const currentOutput = outputs.find((o: { rect: { x: number; y: number; width: number; height: number; }; }) => {
            const rect = o.rect;
            return windowPos.x >= rect.x && windowPos.x < rect.x + rect.width &&
              windowPos.y >= rect.y && windowPos.y < rect.y + rect.height;
          }) || outputs[0];

          if (currentOutput?.rect) {
            console.log('[window] Display:', currentOutput.rect.width + 'x' + currentOutput.rect.height, '(current output)');
            return { width: currentOutput.rect.width, height: currentOutput.rect.height };
          }
        }
      }
    } catch (err) {
      console.error('[window] swaymsg getDisplaySize failed:', err);
    }

    // Fallback to default platform's method
    console.log('[window] Sway falling back to Tauri window API');
    const defaultPlatform = new DefaultPlatform();
    return defaultPlatform.getDisplaySize();
  }
}

/**
 * Platform detection and management
 */
let currentPlatform: WindowPlatform | null = null;

/**
 * Detect if running under Sway window manager
 */
async function detectSway(): Promise<boolean> {
  try {
    const cmd = Command.create('run-sh', ['-c', 'echo $XDG_CURRENT_DESKTOP']);
    const result = await cmd.execute();
    console.log('[window] Sway detection - code:', result.code, 'stdout:', result.stdout);
    const isSway = result.stdout.trim().toLowerCase() === 'sway';
    console.log('[window] Running under Sway:', isSway);
    return isSway;
  } catch (err) {
    console.log('[window] Sway detection failed:', err);
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
export async function setSmallMode(
  corner: Corner,
  settings: Settings
): Promise<void> {
  // Exit fullscreen if active (common to all platforms)
  try {
    const window = getCurrentWindow()
    const isFs = await window.isFullscreen()
    if (isFs) {
      await window.setFullscreen(false)
    }
  } catch (err) {
    console.log('[window] Fullscreen check/exit failed (may not be supported on this platform):', err)
  }

  const platform = await getPlatform();
  await platform.setCornerMode(corner, settings);
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
 * Cycle through corners
 */
export function nextCorner(current: Corner): Corner {
  const corners: Corner[] = ['bottom-right', 'bottom-left', 'top-left', 'top-right']
  const idx = corners.indexOf(current)
  return corners[(idx + 1) % corners.length]
}
