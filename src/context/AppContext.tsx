import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { recoverOrphanedSession, appendSession, clearActiveSession } from '../lib/storage'
import { useTimerEngine } from '../hooks/useTimerEngine'
import { useSettings } from './SettingsContext'
import type { Corner } from '../lib/window'

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
  corner: Corner
  timerState: TimerState | null
  showConfetti: boolean
  lastUsedDuration: number;  // in seconds, defaults to 20m
  lastUsedMode: 'predict' | 'timebox' | 'ai-ab';  // defaults to 'predict'
}

interface AppContextValue extends AppState {
  // Navigation
  setScreen: (screen: Screen) => void

  // Timer mode (zen, small, normal)
  setTimerMode: (mode: TimerMode) => void
  setCorner: (corner: Corner) => void

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
  onTimerStart?: (corner: Corner) => Promise<void>
  onTimerComplete?: () => Promise<void>
  onTimerCancel?: () => Promise<void>
}

export function AppProvider({
  children,
  onTimerStart,
  onTimerComplete,
  onTimerCancel,
}: AppProviderProps) {
  const { settings } = useSettings()
  const [state, setState] = useState<AppState>({
    screen: 'new-focus',
    timerMode: 'normal',
    corner: 'bottom-right',
    timerState: null,
    showConfetti: false,
    lastUsedDuration: 20 * 60,  // Default to 20 minutes
    lastUsedMode: 'predict',  // Default to predict mode
  })

  // Timer engine - runs at app level so it persists across screens
  const { elapsed, remaining, isOvertime, stopBell } = useTimerEngine(state.timerState)

  // Recover orphaned sessions on mount
  useEffect(() => {
    recoverOrphanedSession().catch(console.error)
  }, [])

  const setScreen = (screen: Screen) => setState(s => ({ ...s, screen }))
  const setTimerMode = (timerMode: TimerMode) => setState(s => ({ ...s, timerMode }))
  const setCorner = (corner: Corner) => setState(s => ({ ...s, corner }))

  const startTimer = useCallback(async (focusText: string, predictedSeconds: number, tags: string[], mode: 'predict' | 'timebox' | 'ai-ab') => {
    const currentCorner = state.corner

    setState(s => ({
      ...s,
      screen: 'timer',
      timerMode: settings.autoSmallOnStart ? 'small' : s.timerMode,
      lastUsedDuration: predictedSeconds,  // Remember this duration
      lastUsedMode: mode,  // Remember this mode
      timerState: {
        focusText,
        predictedSeconds,
        startTime: new Date(),
        adjustmentSeconds: 0,
        tags,
      },
    }))

    // Trigger window resize if auto-small is enabled
    if (settings.autoSmallOnStart && onTimerStart) {
      await onTimerStart(currentCorner)
    }
  }, [settings.autoSmallOnStart, onTimerStart, state.corner])

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

    // Let parent handle window mode reset (it has access to settings)
    if (onTimerComplete) {
      await onTimerComplete()
    }

    setState(s => ({
      ...s,
      screen: 'new-focus',
      // Preserve zen/small mode, only reset to normal if already in normal
      timerMode: s.timerMode === 'normal' ? 'normal' : s.timerMode,
      timerState: null,
      showConfetti: true,
    }))
  }, [state, elapsed, stopBell, onTimerComplete])

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

    // Let parent handle window mode reset (it has access to settings)
    if (onTimerCancel) {
      await onTimerCancel()
    }

    setState(s => ({
      ...s,
      screen: 'new-focus',
      // Preserve zen/small mode, only reset to normal if already in normal
      timerMode: s.timerMode === 'normal' ? 'normal' : s.timerMode,
      timerState: null,
      showConfetti: false,
    }))
  }, [state, elapsed, stopBell, onTimerCancel])

  const clearConfetti = () => setState(s => ({ ...s, showConfetti: false }))

  return (
    <AppContext.Provider
      value={{
        ...state,
        setScreen,
        setTimerMode,
        setCorner,
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
