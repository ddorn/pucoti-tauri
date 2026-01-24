import Neutralino from '@neutralinojs/lib'

export interface Settings {
  // Notification
  notificationCommand: string // Custom command with {title} and {body} placeholders

  // Window sizes
  normalWindowWidth: number
  normalWindowHeight: number
  smallWindowWidth: number
  smallWindowHeight: number

  // Small window behavior
  smallWindowBorderless: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  notificationCommand: '', // Empty = use default OS notification
  normalWindowWidth: 600,
  normalWindowHeight: 500,
  smallWindowWidth: 320,
  smallWindowHeight: 120,
  smallWindowBorderless: false,
}

let dataDir: string | null = null

async function getDataDir(): Promise<string> {
  if (dataDir) return dataDir
  const base = await Neutralino.os.getPath('data')
  const kernelInfo = await Neutralino.computer.getKernelInfo()
  if (kernelInfo.variant === 'Windows NT') {
    dataDir = `${base}\\pucoti`
  } else {
    dataDir = `${base}/pucoti`
  }

  try {
    const stats = await Neutralino.filesystem.getStats(dataDir)
    if (!stats.isDirectory) {
      throw new Error('Data directory is not a directory')
    }
  } catch {
    await Neutralino.filesystem.createDirectory(dataDir)
  }
  return dataDir
}

async function getSettingsPath(): Promise<string> {
  const dir = await getDataDir()
  return `${dir}/settings.json`
}

export async function loadSettings(): Promise<Settings> {
  const path = await getSettingsPath()
  try {
    const content = await Neutralino.filesystem.readFile(path)
    const saved = JSON.parse(content)
    // Merge with defaults to handle new settings added in updates
    return { ...DEFAULT_SETTINGS, ...saved }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const path = await getSettingsPath()
  await Neutralino.filesystem.writeFile(path, JSON.stringify(settings, null, 2))
}

/**
 * Execute custom notification command with placeholder substitution.
 * Returns true if command was executed, false if no custom command configured.
 */
export async function executeCustomNotification(title: string, body: string, command: string): Promise<boolean> {
  if (!command.trim()) {
    return false
  }

  const substituted = command
    .replace(/\{title\}/g, escapeShellArg(title))
    .replace(/\{body\}/g, escapeShellArg(body))

  try {
    await Neutralino.os.execCommand(substituted)
    return true
  } catch (err) {
    console.error('Custom notification command failed:', err)
    return false
  }
}

function escapeShellArg(arg: string): string {
  // Simple escaping - wrap in single quotes and escape any single quotes
  return `'${arg.replace(/'/g, "'\\''")}'`
}
