import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { recoverOrphanedSession } from '../lib/storage'

export type Screen = 'new-focus' | 'timer' | 'history'
export type TimerMode = 'normal' | 'presentation' | 'small'
export type Corner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

interface TimerState {
  focusText: string
  predictedSeconds: number
  startTime: Date
  adjustmentSeconds: number // Manual ±1 minute adjustments
}

interface AppState {
  screen: Screen
  timerMode: TimerMode
  corner: Corner
  timerState: TimerState | null
  showConfetti: boolean
}

interface AppContextValue extends AppState {
  setScreen: (screen: Screen) => void
  setTimerMode: (mode: TimerMode) => void
  setCorner: (corner: Corner) => void
  startTimer: (focusText: string, predictedSeconds: number) => void
  adjustTimer: (seconds: number) => void
  completeTimer: () => void
  cancelTimer: () => void
  clearConfetti: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    screen: 'new-focus',
    timerMode: 'normal',
    corner: 'bottom-right',
    timerState: null,
    showConfetti: false,
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

  const completeTimer = () => {
    setState(s => ({
      ...s,
      screen: 'new-focus',
      timerMode: 'normal',
      timerState: null,
      showConfetti: true,
    }))
  }

  const cancelTimer = () => {
    setState(s => ({
      ...s,
      screen: 'new-focus',
      timerMode: 'normal',
      timerState: null,
      showConfetti: false,
    }))
  }

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
