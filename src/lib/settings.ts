import { resolve } from '@tauri-apps/api/path';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { Command } from '@tauri-apps/plugin-shell'
import { getDataDir } from './paths'

export type { Settings } from './settings-types'
export { DEFAULT_SETTINGS } from './settings-types'
import type { Settings } from './settings-types'
import { DEFAULT_SETTINGS } from './settings-types'

async function getSettingsPath(): Promise<string> {
  const dir = await getDataDir()
  return await resolve(dir, 'settings.json')
}

export async function loadSettings(): Promise<Settings> {
  const path = await getSettingsPath()
  try {
    const content = await readTextFile(path)
    const saved = JSON.parse(content)

    // Migration: rename lastUsedMode → lastUsedTimerType (if old key exists)
    if ('lastUsedMode' in saved && !('lastUsedTimerType' in saved)) {
      saved.lastUsedTimerType = saved.lastUsedMode
      delete saved.lastUsedMode
    }

    return { ...DEFAULT_SETTINGS, ...saved }
  } catch (err) {
    console.error('Failed to load settings. Using default settings.', err)
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

export async function executeShellTemplate(
  command: string,
  placeholders: Record<string, string | number>,
  label: string,
): Promise<boolean> {
  if (!command.trim()) {
    return false
  }

  let substituted = command
  for (const [key, value] of Object.entries(placeholders)) {
    const replacement = typeof value === 'string'
      ? `'${value.replace(/'/g, "'\\''")}'`
      : String(value)
    substituted = substituted.replaceAll(`{${key}}`, replacement)
  }

  try {
    const cmd = Command.create('run-sh', ['-c', substituted.trim()])
    const result = await cmd.execute()
    console.log(`[${label}] executed command: ${substituted}`)
    if (result.stdout) console.info(`[${label}] stdout: ${result.stdout}`)
    if (result.stderr) console.error(`[${label}] stderr: ${result.stderr}`)
    if (result.code !== 0) console.error(`[${label}] exited with code ${result.code}`)
    return true
  } catch (err) {
    console.error(`[${label}] command failed: ${err}`)
    return false
  }
}

export async function executeCustomNotification(title: string, body: string, command: string): Promise<boolean> {
  return executeShellTemplate(command, { title, body }, 'notification')
}

export async function executeCompletionHook(focus: string, predicted: number, actual: number, command: string): Promise<boolean> {
  return executeShellTemplate(command, { focus, predicted, actual }, 'completion-hook')
}

export async function executePrefillHook(command: string): Promise<string | null> {
  if (!command.trim()) return null
  try {
    const cmd = Command.create('run-sh', ['-c', command.trim()])
    const result = await cmd.execute()
    if (result.code !== 0) {
      console.error(`[prefill-hook] exited with code ${result.code}`)
      if (result.stdout) console.error(`[prefill-hook] stdout: ${result.stdout}`)
      if (result.stderr) console.error(`[prefill-hook] stderr: ${result.stderr}`)
      return null
    }
    return result.stdout.trim() || null
  } catch (err) {
    console.error(`[prefill-hook] command failed:`, err)
    return null
  }
}
