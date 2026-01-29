import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { recoverOrphanedSession, appendSession, clearActiveSession } from '../lib/storage'
import { useTimerEngine } from '../hooks/useTimerEngine'
import { useDbusSync } from '../hooks/useDbusSync'
import { useSettings } from './SettingsContext'
import { getRandomAccentColor } from '../lib/colors'
import { setSmallMode, setNormalMode } from '../lib/window'

export type Screen = 'new-focus' | 'timer' | 'stats' | 'settings'
export type TimerMode = 'normal' | 'zen' | 'small'

export interface TimerState {
  focusText: string
  predictedSeconds: number
  startTime: Date
  adjustmentSeconds: number
  tags: string[];
}

interface AppState {
  screen: Screen
  timerMode: TimerMode
  timerState: TimerState | null
  showConfetti: boolean;
}

interface AppContextValue extends AppState {
  // Navigation
  setScreen: (screen: Screen) => void

  // Timer mode (zen, small, normal)
  setTimerMode: (mode: TimerMode) => void

  // Timer actions
  startTimer: (focusText: string, predictedSeconds: number, tags: string[], mode: 'predict' | 'timebox' | 'ai-ab') => void
  adjustTimer: (seconds: number) => void
  completeTimer: () => Promise<void>
  cancelTimer: () => Promise<void>

  // Timer engine values (computed from hook)
  elapsed: number
  remaining: number
  isOvertime: boolean

  // UI
  clearConfetti: () => void;
}

const AppContext = createContext<AppContextValue | null>(null)

interface AppProviderProps {
  children: ReactNode
}

export function AppProvider({ children }: AppProviderProps) {
  const { settings, updateSettings } = useSettings()
  const [state, setState] = useState<AppState>({
    screen: 'new-focus',
    timerMode: 'normal',
    timerState: null,
    showConfetti: false,
  })

  // Timer engine - runs at app level so it persists across screens
  const { elapsed, remaining, isOvertime, stopBell } = useTimerEngine(state.timerState)

  // Sync timer state to D-Bus for GNOME panel indicator (always on Linux)
  useDbusSync(state.timerState, remaining, isOvertime)

  // Recover orphaned sessions on mount
  useEffect(() => {
    recoverOrphanedSession().catch(console.error)
  }, [])

  const setScreen = (screen: Screen) => setState(s => ({ ...s, screen }))
  const setTimerMode = (timerMode: TimerMode) => setState(s => ({ ...s, timerMode }))

  const startTimer = useCallback(async (focusText: string, predictedSeconds: number, tags: string[], mode: 'predict' | 'timebox' | 'ai-ab') => {
    // Calculate initial adjustment based on timer start percentage (predict mode only)
    const initialAdjustment = mode === 'predict'
      ? Math.round(predictedSeconds * (settings.timerStartPercentage / 100 - 1))
      : 0

    setState(s => ({
      ...s,
      screen: 'timer',
      timerMode: settings.onTimerStart === 'corner' ? 'small' : s.timerMode,
      timerState: {
        focusText,
        predictedSeconds,
        startTime: new Date(),
        adjustmentSeconds: initialAdjustment,
        tags,
      },
    }))

    // Save last used values to settings (persist across restarts)
    await updateSettings({
      lastUsedDuration: predictedSeconds,
      lastUsedMode: mode,
    })

    // Handle window mode change
    if (settings.onTimerStart === 'corner') {
      await setSmallMode(settings)
    }
  }, [settings, updateSettings])

  const adjustTimer = (seconds: number) => {
    setState(s => {
      if (!s.timerState) return s
      return {
        ...s,
        timerState: {
          ...s.timerState,
          adjustmentSeconds: s.timerState.adjustmentSeconds + seconds,
        },
      }
    })
  }

  const completeTimer = useCallback(async () => {
    const { timerState } = state
    if (!timerState) return

    // Stop bell
    stopBell()

    // Save session
    try {
      await appendSession({
        timestamp: timerState.startTime,
        focusText: timerState.focusText,
        predictedSeconds: timerState.predictedSeconds,
        actualSeconds: elapsed,
        status: 'completed',
        tags: timerState.tags,
      })
      await clearActiveSession()
    } catch (err) {
      console.error('Failed to save session:', err)
    }

    // Change color if random mode is enabled
    if (settings.randomColorOnCompletion) {
      const newColor = getRandomAccentColor(settings.accentColor)
      await updateSettings({ accentColor: newColor })
    }

    // Reset window to normal mode
    await setNormalMode(settings)

    setState(s => ({
      ...s,
      screen: 'new-focus',
      timerState: null,
      showConfetti: true,
    }))
  }, [state, elapsed, stopBell, settings, updateSettings])

  const cancelTimer = useCallback(async () => {
    const { timerState } = state
    if (!timerState) return

    // Stop bell
    stopBell()

    // Save as canceled
    try {
      await appendSession({
        timestamp: timerState.startTime,
        focusText: timerState.focusText,
        predictedSeconds: timerState.predictedSeconds,
        actualSeconds: elapsed,
        status: 'canceled',
        tags: timerState.tags,
      })
      await clearActiveSession()
    } catch (err) {
      console.error('Failed to save session:', err)
    }

    // Reset window to normal mode
    await setNormalMode(settings)

    setState(s => ({
      ...s,
      screen: 'new-focus',
      timerState: null,
      showConfetti: false,
    }))
  }, [state, elapsed, stopBell, settings])

  const clearConfetti = () => setState(s => ({ ...s, showConfetti: false }))

  return (
    <AppContext.Provider
      value={{
        ...state,
        setScreen,
        setTimerMode,
        startTimer,
        adjustTimer,
        completeTimer,
        cancelTimer,
        elapsed,
        remaining,
        isOvertime,
        clearConfetti,
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
