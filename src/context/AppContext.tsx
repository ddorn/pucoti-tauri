import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { timerMachine } from '../lib/timer-machine'
import { useSettings } from './SettingsContext'
import { getRandomAccentColor } from '../lib/colors'
import { useBellSubscriber } from '../hooks/useBellSubscriber'
import { useStorageSubscriber } from '../hooks/useStorageSubscriber'
import { useDbusSubscriber } from '../hooks/useDbusSubscriber'
import { useWindowSubscriber } from '../hooks/useWindowSubscriber'
import { executeCompletionHook } from '../lib/settings'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { setSmallMode, setNormalMode } from '../lib/window'
import { checkForUpdates, type UpdateInfo } from '../lib/update-checker'
import packageJson from '../../package.json'

export type Screen = 'timer' | 'stats' | 'settings' | 'completion'
export type DisplayMode = 'normal' | 'zen' | 'small'

const DEFAULT_COUNTDOWN_SECONDS = 300 // 5 minutes

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
  const { settings, updateSettings } = useSettings()

  const [screen, setScreen] = useState<Screen>('timer')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('normal')
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
    if (displayMode === 'normal') {
      setNormalMode(settingsRef.current).catch(console.error);
    } else if (displayMode === 'small') {
      setSmallMode(settingsRef.current).catch(console.error);
    } else if (displayMode === 'zen') {
      getCurrentWindow().setFullscreen(true).catch(console.error);
    }

    // Corner is changed by directly updating the settings.
    // Is this a good thing? It's probably fine.
  }, [displayMode, settings.corner])

  // Subscribe to timer events for screen navigation and completion data
  useEffect(() => {
    return timerMachine.subscribe(async event => {
      if (event.type === 'completed') {
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


        // Navigate to completion screen
        setScreen('completion')
        setDisplayMode('normal')

        // Reset timer to default countdown state
        timerMachine.reset()
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
    timerMachine.start('', null, DEFAULT_COUNTDOWN_SECONDS, [], 'cancel')
  }, [])

  // Check for updates on mount (if enabled in settings)
  useEffect(() => {
    if (settings.checkForUpdatesAutomatically) {
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
