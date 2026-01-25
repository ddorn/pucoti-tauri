import { appDataDir, resolve } from '@tauri-apps/api/path'
import { readTextFile, writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs'
import { Command } from '@tauri-apps/plugin-shell'

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
  autoSmallOnStart: boolean

  // Corner margins
  cornerMarginTop: number
  cornerMarginRight: number
  cornerMarginBottom: number
  cornerMarginLeft: number
}

export const DEFAULT_SETTINGS: Settings = {
  notificationCommand: '', // Empty = use default OS notification
  normalWindowWidth: 600,
  normalWindowHeight: 500,
  smallWindowWidth: 220,
  smallWindowHeight: 80,
  smallWindowBorderless: false,
  autoSmallOnStart: false,
  cornerMarginTop: 16,
  cornerMarginRight: 16,
  cornerMarginBottom: 16,
  cornerMarginLeft: 16,
}

let dataDir: string | null = null

async function getDataDir(): Promise<string> {
  if (dataDir) return dataDir
  const base = await appDataDir()
  dataDir = await resolve(base, 'pucoti')

  try {
    const dirExists = await exists(dataDir)
    if (!dirExists) {
      await mkdir(dataDir, { recursive: true })
    }
  } catch {
    await mkdir(dataDir, { recursive: true })
  }
  return dataDir
}

async function getSettingsPath(): Promise<string> {
  const dir = await getDataDir()
  return await resolve(dir, 'settings.json')
}

export async function loadSettings(): Promise<Settings> {
  const path = await getSettingsPath()
  try {
    const content = await readTextFile(path)
    const saved = JSON.parse(content)
    // Merge with defaults to handle new settings added in updates
    return { ...DEFAULT_SETTINGS, ...saved }
  } catch (err) {
    console.error('Failed to load settings', err)
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    const path = await getSettingsPath()
    await writeTextFile(path, JSON.stringify(settings, null, 2))
  } catch (err) {
    console.error('Failed to save settings:', err)
    throw err
  }
}

/**
 * Execute custom notification command with placeholder substitution.
 * Returns true if command was executed, false if no custom command configured.
 */
export async function executeCustomNotification(title: string, body: string, command: string): Promise<boolean> {
  if (!command.trim()) {
    return false
  }

  // Escape title and body for shell
  title = title.replace(/'/g, "'\\''")
  body = body.replace(/'/g, "'\\''")

  const substituted = command
    .replace(/\{title\}/g, `'${title}'`)
    .replace(/\{body\}/g, `'${body}'`)

  try {
    // Use scoped sh command with -c to execute arbitrary shell commands
    // This works because run-sh has args: true, allowing any arguments
    const cmd = Command.create('run-sh', ['-c', substituted.trim()])
    await cmd.execute()
    return true
  } catch (err) {
    console.error('Custom notification command failed:', err)
    return false
  }
}
