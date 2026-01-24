import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { recoverOrphanedSession, appendSession, clearActiveSession } from '../lib/storage'
import { useTimerEngine } from '../hooks/useTimerEngine'

export type Screen = 'new-focus' | 'timer' | 'stats' | 'settings'
export type TimerMode = 'normal' | 'zen' | 'small';
export type Corner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

export interface TimerState {
  focusText: string
  predictedSeconds: number
  startTime: Date
  adjustmentSeconds: number
}

interface AppState {
  screen: Screen
  timerMode: TimerMode
  corner: Corner
  timerState: TimerState | null
  showConfetti: boolean
  lastUsedDuration: number;  // in seconds, defaults to 20m
}

interface AppContextValue extends AppState {
  // Navigation
  setScreen: (screen: Screen) => void

  // Timer mode (zen, small, normal)
  setTimerMode: (mode: TimerMode) => void
  setCorner: (corner: Corner) => void

  // Timer actions
  startTimer: (focusText: string, predictedSeconds: number) => void
  adjustTimer: (seconds: number) => void
  completeTimer: () => Promise<void>
  cancelTimer: () => Promise<void>

  // Timer engine values (computed from hook)
  elapsed: number
  remaining: number
  isOvertime: boolean

  // UI
  clearConfetti: () => void

  // Last used duration (in memory only)
  lastUsedDuration: number;
}

const AppContext = createContext<AppContextValue | null>(null)

interface AppProviderProps {
  children: ReactNode
  notificationCommand?: string
  onTimerComplete?: () => Promise<void>
  onTimerCancel?: () => Promise<void>
}

export function AppProvider({
  children,
  notificationCommand,
  onTimerComplete,
  onTimerCancel,
}: AppProviderProps) {
  const [state, setState] = useState<AppState>({
    screen: 'new-focus',
    timerMode: 'normal',
    corner: 'bottom-right',
    timerState: null,
    showConfetti: false,
    lastUsedDuration: 20 * 60,  // Default to 20 minutes
  })

  // Timer engine - runs at app level so it persists across screens
  const { elapsed, remaining, isOvertime, stopBell } = useTimerEngine({
    timerState: state.timerState,
    notificationCommand,
  })

  // Recover orphaned sessions on mount
  useEffect(() => {
    recoverOrphanedSession().catch(console.error)
  }, [])

  const setScreen = (screen: Screen) => setState(s => ({ ...s, screen }))
  const setTimerMode = (timerMode: TimerMode) => setState(s => ({ ...s, timerMode }))
  const setCorner = (corner: Corner) => setState(s => ({ ...s, corner }))

  const startTimer = (focusText: string, predictedSeconds: number) => {
    setState(s => ({
      ...s,
      screen: 'timer',
      lastUsedDuration: predictedSeconds,  // Remember this duration
      timerState: {
        focusText,
        predictedSeconds,
        startTime: new Date(),
        adjustmentSeconds: 0,
      },
    }))
  }

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
        tags: [],
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
        tags: [],
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
