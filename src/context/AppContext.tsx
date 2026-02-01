import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { timerMachine } from '../lib/timer-machine'
import { useSettings } from './SettingsContext'
import { getRandomAccentColor } from '../lib/colors'
import { useBellSubscriber } from '../hooks/useBellSubscriber'
import { useStorageSubscriber } from '../hooks/useStorageSubscriber'
import { useDbusSubscriber } from '../hooks/useDbusSubscriber'
import { useWindowSubscriber } from '../hooks/useWindowSubscriber'
import { executeCompletionHook } from '../lib/settings'

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
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const { settings, updateSettings } = useSettings()

  const [screen, setScreen] = useState<Screen>('timer')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('normal')
  const [completionData, setCompletionData] = useState<CompletionData | null>(null)

  // Mount all subscriber hooks
  useBellSubscriber()
  useStorageSubscriber()
  useDbusSubscriber()
  useWindowSubscriber(setDisplayMode)

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
    timerMachine.start('', null, DEFAULT_COUNTDOWN_SECONDS, [])
  }, [])

  const clearCompletionData = () => setCompletionData(null)

  return (
    <AppContext.Provider
      value={{
        screen,
        displayMode,
        completionData,
        setScreen,
        setDisplayMode,
        clearCompletionData,
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
