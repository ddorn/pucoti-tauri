import Neutralino from '@neutralinojs/lib'

export type Corner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

const SMALL_WIDTH = 320
const SMALL_HEIGHT = 120
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
async function setSwayCornerMode(corner: Corner): Promise<void> {
  const display = await getDisplaySize()
  const positions: Record<Corner, { x: number; y: number }> = {
    'bottom-right': { x: display.width - SMALL_WIDTH - MARGIN, y: display.height - SMALL_HEIGHT - MARGIN },
    'bottom-left': { x: MARGIN, y: display.height - SMALL_HEIGHT - MARGIN },
    'top-right': { x: display.width - SMALL_WIDTH - MARGIN, y: MARGIN },
    'top-left': { x: MARGIN, y: MARGIN },
  }

  const pos = positions[corner]

  // Sway commands: make floating, set size, set position, enable sticky
  const commands = [
    'floating enable',
    `resize set ${SMALL_WIDTH} ${SMALL_HEIGHT}`,
    `move position ${pos.x} ${pos.y}`,
    'sticky enable',
  ]

  for (const cmd of commands) {
    await Neutralino.os.execCommand(`swaymsg '${cmd}'`)
  }
}

/**
 * Set window to normal mode in Sway
 */
async function setSwayNormalMode(): Promise<void> {
  const commands = [
    'sticky disable',
    'floating disable',
  ]

  for (const cmd of commands) {
    await Neutralino.os.execCommand(`swaymsg '${cmd}'`)
  }

  // Center and resize after unfloating
  await Neutralino.window.setSize({ width: 600, height: 500 })
  await Neutralino.window.center()
}

/**
 * Set window to small corner mode
 */
export async function setSmallMode(corner: Corner): Promise<void> {
  if (await isSway()) {
    await setSwayCornerMode(corner)
    return
  }

  // Generic Neutralino fallback
  const display = await getDisplaySize()
  const positions: Record<Corner, { x: number; y: number }> = {
    'bottom-right': { x: display.width - SMALL_WIDTH - MARGIN, y: display.height - SMALL_HEIGHT - MARGIN },
    'bottom-left': { x: MARGIN, y: display.height - SMALL_HEIGHT - MARGIN },
    'top-right': { x: display.width - SMALL_WIDTH - MARGIN, y: MARGIN },
    'top-left': { x: MARGIN, y: MARGIN },
  }

  const pos = positions[corner]
  await Neutralino.window.setAlwaysOnTop(true)
  await Neutralino.window.setSize({ width: SMALL_WIDTH, height: SMALL_HEIGHT })
  await Neutralino.window.move(pos.x, pos.y)
}

/**
 * Set window to normal mode
 */
export async function setNormalMode(): Promise<void> {
  if (await isSway()) {
    await setSwayNormalMode()
    return
  }

  await Neutralino.window.setAlwaysOnTop(false)
  await Neutralino.window.setSize({ width: 600, height: 500 })
  await Neutralino.window.center()
}

/**
 * Toggle fullscreen mode
 */
export async function toggleFullscreen(): Promise<boolean> {
  const isFs = await Neutralino.window.isFullScreen()
  if (isFs) {
    await Neutralino.window.exitFullScreen()
  } else {
    await Neutralino.window.setFullScreen()
  }
  return !isFs
}

/**
 * Cycle through corners
 */
export function nextCorner(current: Corner): Corner {
  const corners: Corner[] = ['bottom-right', 'bottom-left', 'top-left', 'top-right']
  const idx = corners.indexOf(current)
  return corners[(idx + 1) % corners.length]
}
