import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { timerMachine } from '../lib/timer-machine'
import { useSettings } from './SettingsContext'
import { getRandomAccentColor } from '../lib/colors'
import { useBellSubscriber } from '../hooks/useBellSubscriber'
import { useStorageSubscriber } from '../hooks/useStorageSubscriber'
import { useDbusSubscriber } from '../hooks/useDbusSubscriber'
import { useWindowSubscriber } from '../hooks/useWindowSubscriber'
import { checkForUpdates, type UpdateInfo } from '../lib/update-checker'
import { platform, isTauri } from '../lib/platform'
import { executeCompletionHook } from '../lib/shell-hooks'
import packageJson from '../../package.json'

export type Screen = 'timer' | 'stats' | 'settings' | 'completion'
export type DisplayMode = 'normal' | 'zen' | 'small'

// Re-export TimerState from timer-machine for convenience
export type { TimerState } from '../lib/timer-machine'

export interface CompletionData {
  focusText: string
  predictedSeconds: number | null // null for timebox mode
  actualSeconds: number
  tags: string[]
}

interface AppContextValue {
  // UI State
  screen: Screen
  displayMode: DisplayMode
  completionData: CompletionData | null

  // Navigation
  setScreen: (screen: Screen) => void
  setDisplayMode: (mode: DisplayMode) => void

  // Completion
  clearCompletionData: () => void

  // Updates
  updateInfo: UpdateInfo | null
  dismissUpdate: () => void
  checkForUpdatesNow: () => Promise<'success' | 'no-updates' | 'error'>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const { settings, updateSettings, loading } = useSettings()

  const [screen, setScreenRaw] = useState<Screen>('timer')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('normal')

  const setScreen = (newScreen: Screen) => {
    if (newScreen !== 'timer' && displayMode === 'small') {
      setDisplayMode('normal')
    }
    setScreenRaw(newScreen)
  }
  const [completionData, setCompletionData] = useState<CompletionData | null>(null)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)

  // Mount all subscriber hooks
  useBellSubscriber()
  useStorageSubscriber()
  useDbusSubscriber()
  useWindowSubscriber(setDisplayMode)

  // Keep settings ref up to date so we always use latest settings without depending on them
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Automatically apply window mode changes when displayMode changes
  useEffect(() => {
    // Wait until settings are loaded from disk. Otherwise this runs on mount with
    // DEFAULT_SETTINGS and, because the deps don't include the window sizes, never
    // re-applies once the saved sizes arrive (unless `corner` happens to change),
    // leaving the window at its default startup size.
    if (loading) return
    if (displayMode === 'normal') {
      platform.setNormalMode(settingsRef.current).catch(console.error);
    } else if (displayMode === 'small') {
      platform.setSmallMode(settingsRef.current).catch(console.error);
    }
    // zen mode is UI-only, no window function needed

    // Corner is changed by directly updating the settings.
    // Is this a good thing? It's probably fine.
  }, [displayMode, settings.corner, loading])

  // Hand the clock back to a held timer only when the timer screen actually opens.
  // Waiting for that (rather than for the completion screen to close) keeps the resume
  // - and the corner-mode switch that rides on it - from firing while you are reading
  // Stats or Settings. Until then the transient countdown keeps running, so something
  // is always on the clock.
  useEffect(() => {
    if (screen === 'timer') {
      timerMachine.dismissTransient()
    }
  }, [screen])

  // Subscribe to timer events for screen navigation and completion data
  useEffect(() => {
    return timerMachine.subscribe(async event => {
      if (event.type === 'completed') {
        // Navigate first. complete() has already swapped the finished timer for the
        // transient countdown, so anything awaited before this shows a blank 5:00 on
        // the timer screen in the meantime.
        setScreen('completion')

        // Store completion data for the completion screen
        setCompletionData({
          focusText: event.state.focusText,
          predictedSeconds: event.state.predictedSeconds,
          actualSeconds: event.elapsed,
          tags: event.state.tags,
        })

        // Change color if random mode is enabled
        if (settings.randomColorOnCompletion) {
          const newColor = getRandomAccentColor(settings.accentColor)
          await updateSettings({ accentColor: newColor })
        }

        // Run completion hook
        if (settings.completionCommand) {
          executeCompletionHook(
            event.state.focusText,
            event.state.predictedSeconds ?? 0,
            event.elapsed,
            settings.completionCommand,
          ).catch(err => console.error('Completion hook failed:', err))
        }
      }

      if (event.type === 'started') {
        // Save last used duration if prediction was made
        if (event.state.predictedSeconds !== null) {
          await updateSettings({ lastUsedDuration: event.state.predictedSeconds })
        }
      }
    })
  }, [settings.randomColorOnCompletion, settings.accentColor, updateSettings])

  // Initialize timer on mount
  useEffect(() => {
    // Start with default countdown state
    timerMachine.reset()
  }, [])

  // Check for updates on mount (desktop only — web is always current)
  useEffect(() => {
    if (isTauri && settings.checkForUpdatesAutomatically) {
      checkForUpdates(packageJson.version).then(update => {
        if (update) {
          console.log('[Update Check] Update available:', update.version)
          setUpdateInfo(update)
        }
      }).catch(err => console.error('[Update Check] Failed:', err))
    }
  }, [settings.checkForUpdatesAutomatically])

  const clearCompletionData = () => setCompletionData(null)

  const dismissUpdate = async () => {
    if (updateInfo) {
      await updateSettings({ dismissedUpdateVersion: updateInfo.version })
    }
  }

  const checkForUpdatesNow = async (): Promise<'success' | 'no-updates' | 'error'> => {
    try {
      const update = await checkForUpdates(packageJson.version)
      if (update) {
        console.log('[Update Check] Update available:', update.version)
        setUpdateInfo(update)
        return 'success'
      } else {
        console.log('[Update Check] No update available')
        return 'no-updates'
      }
    } catch (err) {
      console.error('[Update Check] Failed:', err)
      return 'error'
    }
  }

  return (
    <AppContext.Provider
      value={{
        screen,
        displayMode,
        completionData,
        setScreen,
        setDisplayMode,
        clearCompletionData,
        updateInfo,
        dismissUpdate,
        checkForUpdatesNow,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}
