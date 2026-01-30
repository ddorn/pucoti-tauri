import { useState, useEffect, useRef, useCallback } from 'react'
import { playBell, showNotification } from '../lib/sound'
import { useSettings } from '../context/SettingsContext'
import { formatDuration } from '../lib/format';

const TIMER_TICK_INTERVAL = 200; // milliseconds - update frequency for timer display

interface TimerState {
  focusText: string
  predictedSeconds: number | null  // null = timebox mode
  startTime: Date
  adjustmentSeconds: number
}

interface TimerEngineResult {
  elapsed: number
  remaining: number
  isOvertime: boolean
  stopBell: () => void
}

/**
 * Core timer engine that handles:
 * - Elapsed time calculation
 * - Overtime detection
 * - Bell ringing (initial + repeating)
 * - Notification every time timer crosses 0
 *
 * This hook should be used at the App level so it persists across screen changes.
 */
export function useTimerEngine(timerState: TimerState | null): TimerEngineResult {
  const { settings } = useSettings()
  const [elapsed, setElapsed] = useState(0)
  const [wasOvertime, setWasOvertime] = useState(false)
  const bellIntervalRef = useRef<number | null>(null)
  const prevBellIntervalRef = useRef<number>(settings.bellRepeatIntervalSeconds)

  // Compute remaining time
  const predicted = timerState?.predictedSeconds ?? 0
  const adjustment = timerState?.adjustmentSeconds ?? 0
  const remaining = predicted + adjustment - elapsed
  const isOvertime = remaining < 0

  // Reset state when timer changes (new session started)
  useEffect(() => {
    if (timerState) {
      setWasOvertime(false)
      // Calculate initial elapsed immediately
      const now = Date.now()
      const start = timerState.startTime.getTime()
      setElapsed(Math.floor((now - start) / 1000))
    } else {
      setElapsed(0)
      setWasOvertime(false)
    }
  }, [timerState?.startTime.getTime()]) // Only reset on new timer, not adjustment changes

  // Timer tick
  useEffect(() => {
    if (!timerState) return

    const tick = () => {
      const now = Date.now()
      const start = timerState.startTime.getTime()
      setElapsed(Math.floor((now - start) / 1000))
    }

    tick() // Immediate first tick
    const interval = setInterval(tick, TIMER_TICK_INTERVAL)
    return () => clearInterval(interval)
  }, [timerState])

  // Handle bell ringing and notifications every time we cross into overtime (including after j/k adjustments)
  useEffect(() => {
    if (!timerState) return

    if (isOvertime && !wasOvertime) {
      // Just crossed into overtime (e.g., after adding time with k then it ran out again)
      playBell(settings.customBellPath)
      const message = timerState.focusText
        ? `You focused on ${timerState.focusText} for ${formatDuration(elapsed)}`
        : `Timer finished after ${formatDuration(elapsed)}`
      showNotification('Time\'s up!', message, settings.notificationCommand)
      setWasOvertime(true)
    } else if (!isOvertime && wasOvertime) {
      // Exited overtime (e.g., added time with k)
      setWasOvertime(false)
    }
  }, [isOvertime, wasOvertime, timerState, settings.customBellPath, settings.notificationCommand, elapsed])

  // Start/stop repeating bell when entering/exiting overtime
  useEffect(() => {
    if (isOvertime && timerState) {
      // Start repeating bell (only if interval > 0)
      if (!bellIntervalRef.current && settings.bellRepeatIntervalSeconds > 0) {
        const intervalMs = settings.bellRepeatIntervalSeconds * 1000;
        bellIntervalRef.current = window.setInterval(() => playBell(settings.customBellPath), intervalMs);
        prevBellIntervalRef.current = settings.bellRepeatIntervalSeconds
      }
    } else {
      // Stop repeating bell
      if (bellIntervalRef.current) {
        clearInterval(bellIntervalRef.current)
        bellIntervalRef.current = null
      }
    }

    return () => {
      if (bellIntervalRef.current) {
        clearInterval(bellIntervalRef.current)
        bellIntervalRef.current = null
      }
    }
  }, [isOvertime, timerState, settings.bellRepeatIntervalSeconds, settings.customBellPath])

  // Restart interval when setting changes while in overtime
  useEffect(() => {
    if (isOvertime && timerState) {
      if (prevBellIntervalRef.current !== settings.bellRepeatIntervalSeconds) {
        // Setting changed - restart with new interval (or stop if 0)
        if (bellIntervalRef.current) {
          clearInterval(bellIntervalRef.current);
          bellIntervalRef.current = null;
        }
        if (settings.bellRepeatIntervalSeconds > 0) {
          const intervalMs = settings.bellRepeatIntervalSeconds * 1000;
          bellIntervalRef.current = window.setInterval(() => playBell(settings.customBellPath), intervalMs);
        }
        prevBellIntervalRef.current = settings.bellRepeatIntervalSeconds;
      }
    }
  }, [settings.bellRepeatIntervalSeconds, isOvertime, timerState, settings.customBellPath])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bellIntervalRef.current) {
        clearInterval(bellIntervalRef.current)
        bellIntervalRef.current = null
      }
    }
  }, [])

  const stopBell = useCallback(() => {
    if (bellIntervalRef.current) {
      clearInterval(bellIntervalRef.current)
      bellIntervalRef.current = null
    }
  }, [])

  return {
    elapsed,
    remaining,
    isOvertime,
    stopBell,
  }
}
