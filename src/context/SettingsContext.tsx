import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { loadSettings, saveSettings, detectGnome, DEFAULT_SETTINGS, type Settings } from '../lib/settings'

interface SettingsContextValue {
  settings: Settings
  loading: boolean
  updateSettings: (updates: Partial<Settings>) => Promise<void>
  resetSettings: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  // Load settings on mount
  useEffect(() => {
    async function initSettings() {
      try {
        const loaded = await loadSettings()

        // Auto-detect GNOME on first run (when useGnomePanelIndicator is null)
        if (loaded.useGnomePanelIndicator === null) {
          const isGnome = await detectGnome()
          loaded.useGnomePanelIndicator = isGnome
          await saveSettings(loaded)
        }

        setSettings(loaded)
      } catch (err) {
        console.error('Failed to load settings:', err)
      } finally {
        setLoading(false)
      }
    }
    initSettings()
  }, [])

  const updateSettings = useCallback(async (updates: Partial<Settings>) => {
    const newSettings = { ...settings, ...updates }
    setSettings(newSettings)
    try {
      await saveSettings(newSettings)
    } catch (err) {
      console.error('Failed to save settings:', err)
      // Revert state on error
      setSettings(settings)
      throw err
    }
  }, [settings])

  const resetSettings = useCallback(async () => {
    setSettings(DEFAULT_SETTINGS)
    await saveSettings(DEFAULT_SETTINGS)
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider')
  }
  return context
}
