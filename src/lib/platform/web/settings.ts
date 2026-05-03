import { DEFAULT_SETTINGS, type Settings } from '../../settings-types'

const SETTINGS_KEY = 'pucoti_settings'

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }

    const saved = JSON.parse(raw)

    // Migration: rename lastUsedMode → lastUsedTimerType
    if ('lastUsedMode' in saved && !('lastUsedTimerType' in saved)) {
      saved.lastUsedTimerType = saved.lastUsedMode
      delete saved.lastUsedMode
    }

    return { ...DEFAULT_SETTINGS, ...saved }
  } catch (err) {
    console.error('Failed to load settings from localStorage:', err)
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch (err) {
    console.error('Failed to save settings to localStorage:', err)
    throw err
  }
}
