import { resolve } from '@tauri-apps/api/path';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { getDataDir } from './paths'
import type { Settings } from '../../settings-types'
import { DEFAULT_SETTINGS } from '../../settings-types'

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

