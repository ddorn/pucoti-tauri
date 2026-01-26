import { getCurrentWindow, primaryMonitor, availableMonitors } from '@tauri-apps/api/window'
import { LogicalSize, LogicalPosition } from '@tauri-apps/api/dpi'
import { Command } from '@tauri-apps/plugin-shell'
import type { Settings } from './settings'

export type Corner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

/**
 * Detect if running under Sway window manager
 */
async function isSway(): Promise<boolean> {
  try {
    const cmd = Command.create('run-sh', ['-c', 'echo $XDG_CURRENT_DESKTOP'])
    const result = await cmd.execute()
    return result.stdout.trim().toLowerCase() === 'sway'
  } catch {
    return false
  }
}

/**
 * Get display dimensions - tries Sway first, falls back to window API
 */
async function getDisplaySize(): Promise<{ width: number; height: number }> {
  // Try swaymsg first for accurate Sway output info
  try {
    const cmd = Command.create('run-swaymsg', ['-t', 'get_outputs'])
    const result = await cmd.execute()
    if (result.code === 0) {
      const outputs = JSON.parse(result.stdout)
      // Use focused output if available, otherwise use the output containing the current window
      // For Sway, we can check which output contains the window's position
      const focused = outputs.find((o: { focused: boolean }) => o.focused)
      if (focused?.rect) {
        return { width: focused.rect.width, height: focused.rect.height }
      }
      // Fallback: try to get current window's monitor
      if (outputs.length > 0) {
        const window = getCurrentWindow()
        const windowPos = await window.outerPosition()
        // Find output that contains this window position
        const currentOutput = outputs.find((o: { rect: { x: number; y: number; width: number; height: number } }) => {
          const rect = o.rect
          return windowPos.x >= rect.x && windowPos.x < rect.x + rect.width &&
                 windowPos.y >= rect.y && windowPos.y < rect.y + rect.height
        }) || outputs[0]
        if (currentOutput?.rect) {
          return { width: currentOutput.rect.width, height: currentOutput.rect.height }
        }
      }
    }
  } catch {
    // Not Sway or swaymsg failed
  }

  // Fallback to window API - try to get current window's monitor
  try {
    const window = getCurrentWindow()
    // Try to get the monitor that contains the current window
    const monitors = await availableMonitors()
    const windowPos = await window.outerPosition()
    if (monitors && monitors.length > 0) {
      // Find monitor containing the window
      const currentMonitor = monitors.find(m => {
        const pos = m.position
        const size = m.size
        return windowPos.x >= pos.x && windowPos.x < pos.x + size.width &&
               windowPos.y >= pos.y && windowPos.y < pos.y + size.height
      }) || monitors[0] // Fallback to first monitor if not found

      if (currentMonitor) {
        const size = currentMonitor.size
        return {
          width: size.width,
          height: size.height
        }
      }
    }
    // Fallback to primary monitor
    const monitor = await primaryMonitor()
    if (monitor) {
      const size = monitor.size
      return {
        width: size.width,
        height: size.height
      }
    }
  } catch {
    // Fallback to common resolution
  }

  return { width: 1920, height: 1080 }
}

/**
 * Set window to small corner mode using Sway-specific commands
 */
async function setSwayCornerMode(
  corner: Corner,
  width: number,
  height: number,
  borderless: boolean,
  margins: { cornerMarginTop: number; cornerMarginRight: number; cornerMarginBottom: number; cornerMarginLeft: number }
): Promise<void> {
  const display = await getDisplaySize();
  const { cornerMarginTop, cornerMarginRight, cornerMarginBottom, cornerMarginLeft } = margins;
  const positions: Record<Corner, { x: number; y: number }> = {
    'bottom-right': { x: display.width - width - cornerMarginRight, y: display.height - height - cornerMarginBottom },
    'bottom-left': { x: cornerMarginLeft, y: display.height - height - cornerMarginBottom },
    'top-right': { x: display.width - width - cornerMarginRight, y: cornerMarginTop },
    'top-left': { x: cornerMarginLeft, y: cornerMarginTop },
  };

  const pos = positions[corner];

  // Combine commands into a single swaymsg invocation
  const command = [
    'floating enable',
    `border ${borderless ? 'none' : 'normal'}`,
    `resize set ${width} ${height}`,
    `move absolute position ${pos.x} ${pos.y}`,
    'sticky enable'
  ].join(', ');

  const cmd = Command.create('run-swaymsg', [command])
  await cmd.execute()
}

/**
 * Set window to normal mode in Sway
 */
async function setSwayNormalMode(width: number, height: number): Promise<void> {
  // Combine all commands, including resize, into a single swaymsg call
  const command = [
    // 'sticky disable',
    // 'border normal',  // uncomment if needed
    // 'floating disable', // uncomment if needed
    `resize set ${width} ${height}`,
    'move absolute position center'
  ].join(', ');

  const cmd = Command.create('run-swaymsg', [command])
  await cmd.execute()
}

/**
 * Set window to small corner mode
 */
export async function setSmallMode(
  corner: Corner,
  settings: Settings
): Promise<void> {
  const { smallWindowWidth, smallWindowHeight, smallWindowBorderless, cornerMarginTop, cornerMarginRight, cornerMarginBottom, cornerMarginLeft } = settings

  // Exit fullscreen if active
  try {
    const window = getCurrentWindow()
    const isFs = await window.isFullscreen()
    if (isFs) {
      await window.setFullscreen(false)
    }
  } catch {
    // Fullscreen check/exit not supported
  }

  if (await isSway()) {
    await setSwayCornerMode(corner, smallWindowWidth, smallWindowHeight, smallWindowBorderless, {
      cornerMarginTop,
      cornerMarginRight,
      cornerMarginBottom,
      cornerMarginLeft,
    })
    return
  }

  // Generic Tauri fallback
  const display = await getDisplaySize()
  const positions: Record<Corner, { x: number; y: number }> = {
    'bottom-right': { x: display.width - smallWindowWidth - cornerMarginRight, y: display.height - smallWindowHeight - cornerMarginBottom },
    'bottom-left': { x: cornerMarginLeft, y: display.height - smallWindowHeight - cornerMarginBottom },
    'top-right': { x: display.width - smallWindowWidth - cornerMarginRight, y: cornerMarginTop },
    'top-left': { x: cornerMarginLeft, y: cornerMarginTop },
  }

  const pos = positions[corner]
  const window = getCurrentWindow()
  await window.setAlwaysOnTop(true)
  await window.setSize(new LogicalSize(smallWindowWidth, smallWindowHeight))
  await window.setPosition(new LogicalPosition(pos.x, pos.y))
}

/**
 * Set window to normal mode
 */
export async function setNormalMode(
  settings: Settings
): Promise<void> {
  const { normalWindowWidth, normalWindowHeight } = settings

  if (await isSway()) {
    await setSwayNormalMode(normalWindowWidth, normalWindowHeight)
    return
  }

  const window = getCurrentWindow()
  await window.setAlwaysOnTop(false)
  await window.setSize(new LogicalSize(normalWindowWidth, normalWindowHeight))
  await window.center()
}

/**
 * Cycle through corners
 */
export function nextCorner(current: Corner): Corner {
  const corners: Corner[] = ['bottom-right', 'bottom-left', 'top-left', 'top-right']
  const idx = corners.indexOf(current)
  return corners[(idx + 1) % corners.length]
}
