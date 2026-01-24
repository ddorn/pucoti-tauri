import Neutralino from '@neutralinojs/lib'
import type { Settings } from './settings'

export type Corner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

const MARGIN = 16

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
  borderless: boolean
): Promise<void> {
  const display = await getDisplaySize()
  const positions: Record<Corner, { x: number; y: number }> = {
    'bottom-right': { x: display.width - width - MARGIN, y: display.height - height - MARGIN },
    'bottom-left': { x: MARGIN, y: display.height - height - MARGIN },
    'top-right': { x: display.width - width - MARGIN, y: MARGIN },
    'top-left': { x: MARGIN, y: MARGIN },
  }

  const pos = positions[corner]

  // Sway commands: make floating, set size, set position, enable sticky
  const commands = [
    'floating enable',
    `resize set ${width} ${height}`,
    `move position ${pos.x} ${pos.y}`,
    'sticky enable',
  ]

  // Add border command for Sway
  if (borderless) {
    commands.push('border none')
  } else {
    commands.push('border normal')
  }

  for (const cmd of commands) {
    await Neutralino.os.execCommand(`swaymsg '${cmd}'`)
  }
}

/**
 * Set window to normal mode in Sway
 */
async function setSwayNormalMode(width: number, height: number): Promise<void> {
  const commands = [
    'sticky disable',
    'border normal',
    'floating disable',
  ]

  for (const cmd of commands) {
    await Neutralino.os.execCommand(`swaymsg '${cmd}'`)
  }

  // Center and resize after unfloating
  await Neutralino.window.setSize({ width, height })
  await Neutralino.window.center()
}

/**
 * Set window to small corner mode
 */
export async function setSmallMode(
  corner: Corner,
  settings: Pick<Settings, 'smallWindowWidth' | 'smallWindowHeight' | 'smallWindowBorderless'>
): Promise<void> {
  const { smallWindowWidth, smallWindowHeight, smallWindowBorderless } = settings

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
    await setSwayCornerMode(corner, smallWindowWidth, smallWindowHeight, smallWindowBorderless)
    return
  }

  // Generic Neutralino fallback
  const display = await getDisplaySize()
  const positions: Record<Corner, { x: number; y: number }> = {
    'bottom-right': { x: display.width - smallWindowWidth - MARGIN, y: display.height - smallWindowHeight - MARGIN },
    'bottom-left': { x: MARGIN, y: display.height - smallWindowHeight - MARGIN },
    'top-right': { x: display.width - smallWindowWidth - MARGIN, y: MARGIN },
    'top-left': { x: MARGIN, y: MARGIN },
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
