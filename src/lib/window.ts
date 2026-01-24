import Neutralino from '@neutralinojs/lib'
import type { Settings } from './settings'

export type Corner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

/**
 * Detect if running under Sway window manager
 */
async function isSway(): Promise<boolean> {
  try {
    const result = await Neutralino.os.execCommand('echo $XDG_CURRENT_DESKTOP')
    return result.stdOut.trim().toLowerCase() === 'sway'
  } catch {
    return false
  }
}

/**
 * Get display dimensions - tries Sway first, falls back to Neutralino
 */
async function getDisplaySize(): Promise<{ width: number; height: number }> {
  // Try swaymsg first for accurate Sway output info
  try {
    const result = await Neutralino.os.execCommand('swaymsg -t get_outputs')
    if (result.exitCode === 0) {
      const outputs = JSON.parse(result.stdOut)
      const focused = outputs.find((o: { focused: boolean }) => o.focused) || outputs[0]
      if (focused?.rect) {
        return { width: focused.rect.width, height: focused.rect.height }
      }
    }
  } catch {
    // Not Sway or swaymsg failed
  }

  // Fallback to Neutralino
  try {
    const displays = await Neutralino.computer.getDisplays()
    if (displays.length > 0) {
      return displays[0].resolution
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
  margins: Pick<Settings, 'cornerMarginTop' | 'cornerMarginRight' | 'cornerMarginBottom' | 'cornerMarginLeft'>
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
    `resize set ${width} ${height}`,
    `border ${borderless ? 'none' : 'normal'}`,
    `move absolute position ${pos.x} ${pos.y}`,
    'sticky enable'
  ].join(', ');

  console.log(command);

  await Neutralino.os.execCommand(`swaymsg '${command}'`);
}

/**
 * Set window to normal mode in Sway
 */
async function setSwayNormalMode(width: number, height: number): Promise<void> {
  // Combine all commands, including resize, into a single swaymsg call
  const command = [
    'sticky disable',
    // 'border normal',  // uncomment if needed
    // 'floating disable', // uncomment if needed
    `resize set ${width} ${height}`,
    'move absolute position center'
  ].join(', ');

  await Neutralino.os.execCommand(`swaymsg '${command}'`);
}

/**
 * Set window to small corner mode
 */
export async function setSmallMode(
  corner: Corner,
  settings: Pick<Settings, 'smallWindowWidth' | 'smallWindowHeight' | 'smallWindowBorderless' | 'cornerMarginTop' | 'cornerMarginRight' | 'cornerMarginBottom' | 'cornerMarginLeft'>
): Promise<void> {
  const { smallWindowWidth, smallWindowHeight, smallWindowBorderless, cornerMarginTop, cornerMarginRight, cornerMarginBottom, cornerMarginLeft } = settings

  // Exit fullscreen if active
  try {
    const isFs = await Neutralino.window.isFullScreen();
    if (isFs) {
      await Neutralino.window.exitFullScreen();
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

  // Generic Neutralino fallback
  const display = await getDisplaySize()
  const positions: Record<Corner, { x: number; y: number }> = {
    'bottom-right': { x: display.width - smallWindowWidth - cornerMarginRight, y: display.height - smallWindowHeight - cornerMarginBottom },
    'bottom-left': { x: cornerMarginLeft, y: display.height - smallWindowHeight - cornerMarginBottom },
    'top-right': { x: display.width - smallWindowWidth - cornerMarginRight, y: cornerMarginTop },
    'top-left': { x: cornerMarginLeft, y: cornerMarginTop },
  }

  const pos = positions[corner]
  await Neutralino.window.setAlwaysOnTop(true)
  await Neutralino.window.setSize({ width: smallWindowWidth, height: smallWindowHeight })
  await Neutralino.window.move(pos.x, pos.y)
}

/**
 * Set window to normal mode
 */
export async function setNormalMode(
  settings: Pick<Settings, 'normalWindowWidth' | 'normalWindowHeight'>
): Promise<void> {
  const { normalWindowWidth, normalWindowHeight } = settings

  if (await isSway()) {
    await setSwayNormalMode(normalWindowWidth, normalWindowHeight)
    return
  }

  await Neutralino.window.setAlwaysOnTop(false)
  await Neutralino.window.setSize({ width: normalWindowWidth, height: normalWindowHeight })
  await Neutralino.window.center()
}

/**
 * Cycle through corners
 */
export function nextCorner(current: Corner): Corner {
  const corners: Corner[] = ['bottom-right', 'bottom-left', 'top-left', 'top-right']
  const idx = corners.indexOf(current)
  return corners[(idx + 1) % corners.length]
}
