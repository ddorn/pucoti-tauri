import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { appendSession } from '../lib/storage';
import { useTimerEngine } from '../hooks/useTimerEngine'
import { useDbusSync } from '../hooks/useDbusSync'
import { useSettings } from './SettingsContext'
import { getRandomAccentColor } from '../lib/colors'
import { setSmallMode, setNormalMode } from '../lib/window'
import { getCurrentWindow } from '@tauri-apps/api/window'

export type Screen = 'new-focus' | 'timer' | 'stats' | 'settings' | 'completion';
export type TimerMode = 'normal' | 'zen' | 'small'

export interface TimerState {
  focusText: string
  predictedSeconds: number
  startTime: Date
  adjustmentSeconds: number
  tags: string[];
}

export interface CompletionData {
  focusText: string;
  predictedSeconds: number;
  actualSeconds: number;
  tags: string[];
}

interface AppState {
  screen: Screen
  timerMode: TimerMode
  timerState: TimerState | null
  completionData: CompletionData | null
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
  clearCompletionData: () => void;
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
    completionData: null,
    showConfetti: false,
  })

  // Timer engine - runs at app level so it persists across screens
  const { elapsed, remaining, isOvertime, stopBell } = useTimerEngine(state.timerState)

  // Sync timer state to D-Bus for GNOME panel indicator (always on Linux)
  useDbusSync(state.timerState, remaining, isOvertime)

  // Handle window close: save current session with status 'unknown' if timer is active
  useEffect(() => {
    const window = getCurrentWindow();
    const unlisten = window.onCloseRequested(async () => {
      if (state.timerState) {
        try {
          // Calculate elapsed time from start time
          const startTime = state.timerState.startTime;
          const now = new Date();
          const actualSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);

          await appendSession({
            timestamp: startTime,
            focusText: state.timerState.focusText,
            predictedSeconds: state.timerState.predictedSeconds,
            actualSeconds,
            status: 'unknown',
            tags: state.timerState.tags,
          });
        } catch (err) {
          console.error('Failed to save session on window close:', err);
        }
      }
      // Don't prevent default - let window close normally
    });

    return () => {
      unlisten.then(fn => fn()).catch(console.error);
    };
  }, [state.timerState])

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

    // Prepare completion data
    const completionData: CompletionData = {
      focusText: timerState.focusText,
      predictedSeconds: timerState.predictedSeconds,
      actualSeconds: elapsed,
      tags: timerState.tags,
    }

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
      screen: 'completion',
      timerState: null,
      completionData,
      showConfetti: false, // Completion screen will handle confetti
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
  const clearCompletionData = () => setState(s => ({ ...s, completionData: null }))

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
