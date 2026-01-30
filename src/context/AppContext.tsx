import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { appendSession } from '../lib/storage';
import { executeCompletionHook } from '../lib/settings';
import { useTimerEngine } from '../hooks/useTimerEngine'
import { useDbusSync } from '../hooks/useDbusSync'
import { useSettings } from './SettingsContext'
import { getRandomAccentColor } from '../lib/colors'
import { setSmallMode, setNormalMode } from '../lib/window'
import { getCurrentWindow } from '@tauri-apps/api/window'

export type Screen = 'timer' | 'stats' | 'settings' | 'completion';
export type DisplayMode = 'normal' | 'zen' | 'small'

const DEFAULT_COUNTDOWN_SECONDS = 300 // 5 minutes

export interface TimerState {
  focusText: string              // Empty string if no intent
  predictedSeconds: number | null  // null = timebox mode
  startTime: Date
  adjustmentSeconds: number      // The countdown target (default 300, reset when prediction set)
  tags: string[];
}

export interface CompletionData {
  focusText: string;
  predictedSeconds: number | null;  // null for timebox mode
  actualSeconds: number;
  tags: string[];
}

interface AppState {
  screen: Screen
  displayMode: DisplayMode
  timerState: TimerState | null
  completionData: CompletionData | null
  showConfetti: boolean;
}

interface AppContextValue extends AppState {
  // Navigation
  setScreen: (screen: Screen) => void

  // Display mode (zen, small, normal)
  setDisplayMode: (mode: DisplayMode) => void

  // Timer actions
  setIntentAndPrediction: (intent: string, seconds: number | null) => void
  adjustTimer: (seconds: number) => void
  completeTimer: () => Promise<void>
  cancelTimer: () => Promise<void>
  resetTimer: () => void  // Reset to default state (5m countdown, no intent)

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

function createDefaultTimerState(): TimerState {
  return {
    focusText: '',
    predictedSeconds: null,
    startTime: new Date(),
    adjustmentSeconds: DEFAULT_COUNTDOWN_SECONDS,
    tags: [],
  }
}

export function AppProvider({ children }: AppProviderProps) {
  const { settings, updateSettings } = useSettings()
  const [state, setState] = useState<AppState>({
    screen: 'timer',
    displayMode: 'normal',
    timerState: createDefaultTimerState(),
    completionData: null,
    showConfetti: false,
  })

  // Timer engine - runs at app level so it persists across screens
  const { elapsed, remaining, isOvertime, stopBell } = useTimerEngine(state.timerState)

  // Sync timer state to D-Bus for GNOME panel indicator (always on Linux)
  useDbusSync(state.timerState, remaining, isOvertime)

  // Handle window close: save current session with status 'unknown' if there's an active intent
  useEffect(() => {
    const window = getCurrentWindow();
    const unlisten = window.onCloseRequested(async () => {
      // Only save if there's an intent (focusText) set
      if (state.timerState?.focusText) {
        try {
          // Calculate elapsed time from start time
          const startTime = state.timerState.startTime;
          const now = new Date();
          const actualSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);

          await appendSession({
            timestamp: startTime,
            focusText: state.timerState.focusText,
            predictedSeconds: state.timerState.predictedSeconds ?? 0,
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
  const setDisplayMode = (displayMode: DisplayMode) => setState(s => ({ ...s, displayMode }))

  const setIntentAndPrediction = useCallback(async (intent: string, seconds: number | null) => {
    // Calculate initial adjustment based on timer start percentage (prediction mode only)
    const initialAdjustment = seconds !== null
      ? Math.round(seconds * (settings.timerStartPercentage / 100 - 1))
      : DEFAULT_COUNTDOWN_SECONDS

    const hasPrediction = seconds !== null
    const tags = hasPrediction ? ['mode:predict'] : ['mode:timebox']

    setState(s => ({
      ...s,
      displayMode: settings.onTimerStart === 'corner' ? 'small' : s.displayMode,
      timerState: {
        focusText: intent,
        predictedSeconds: seconds,
        startTime: new Date(),
        adjustmentSeconds: hasPrediction ? initialAdjustment : DEFAULT_COUNTDOWN_SECONDS,
        tags,
      },
    }))

    // Save last used duration to settings if prediction was made
    if (seconds !== null) {
      await updateSettings({ lastUsedDuration: seconds })
    }

    // Handle window mode change
    if (settings.onTimerStart === 'corner') {
      await setSmallMode(settings)
    }
  }, [settings, updateSettings])

  const resetTimer = useCallback(() => {
    setState(s => ({
      ...s,
      timerState: createDefaultTimerState(),
    }))
  }, [])

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
    // Can only complete if there's an intent (focusText)
    if (!timerState || !timerState.focusText) return

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
        predictedSeconds: timerState.predictedSeconds ?? 0,  // Store 0 for timebox sessions
        actualSeconds: elapsed,
        status: 'completed',
        tags: timerState.tags,
      })
    } catch (err) {
      console.error('Failed to save session:', err)
    }

    // Run completion hook
    if (settings.completionCommand) {
      executeCompletionHook(
        timerState.focusText,
        timerState.predictedSeconds,
        elapsed,
        settings.completionCommand,
      ).catch(err => console.error('Completion hook failed:', err))
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
      displayMode: 'normal',  // Explicitly set to normal mode
      timerState: createDefaultTimerState(),  // Reset timer instead of null
      completionData,
      showConfetti: false, // Completion screen will handle confetti
    }))
  }, [state, elapsed, stopBell, settings, updateSettings])

  const cancelTimer = useCallback(async () => {
    const { timerState } = state
    if (!timerState) return

    // Stop bell
    stopBell()

    // Only save session if there was an intent set
    if (timerState.focusText) {
      try {
        await appendSession({
          timestamp: timerState.startTime,
          focusText: timerState.focusText,
          predictedSeconds: timerState.predictedSeconds ?? 0,
          actualSeconds: elapsed,
          status: 'canceled',
          tags: timerState.tags,
        })
      } catch (err) {
        console.error('Failed to save session:', err)
      }
    }

    // Reset window to normal mode
    await setNormalMode(settings)

    // Reset timer to default state (stay on timer screen)
    setState(s => ({
      ...s,
      timerState: createDefaultTimerState(),
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
        setDisplayMode,
        setIntentAndPrediction,
        adjustTimer,
        completeTimer,
        cancelTimer,
        resetTimer,
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
