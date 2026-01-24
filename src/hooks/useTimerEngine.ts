import { useState, useEffect, useRef, useCallback } from 'react'
import { playBell, showNotification } from '../lib/sound'

const BELL_REPEAT_INTERVAL = 20000 // 20 seconds

interface TimerState {
  focusText: string
  predictedSeconds: number
  startTime: Date
  adjustmentSeconds: number
}

interface TimerEngineOptions {
  timerState: TimerState | null
  notificationCommand?: string
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
 * - Notification on first overtime
 *
 * This hook should be used at the App level so it persists across screen changes.
 */
export function useTimerEngine({ timerState, notificationCommand }: TimerEngineOptions): TimerEngineResult {
  const [elapsed, setElapsed] = useState(0)
  const [hasNotified, setHasNotified] = useState(false)
  const [wasOvertime, setWasOvertime] = useState(false)
  const bellIntervalRef = useRef<number | null>(null)

  // Compute remaining time
  const predicted = timerState?.predictedSeconds ?? 0
  const adjustment = timerState?.adjustmentSeconds ?? 0
  const remaining = predicted + adjustment - elapsed
  const isOvertime = remaining < 0

  // Reset state when timer changes (new session started)
  useEffect(() => {
    if (timerState) {
      setHasNotified(false)
      setWasOvertime(false)
      // Calculate initial elapsed immediately
      const now = Date.now()
      const start = timerState.startTime.getTime()
      setElapsed(Math.floor((now - start) / 1000))
    } else {
      setElapsed(0)
      setHasNotified(false)
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
    const interval = setInterval(tick, 200) // Update frequently for accuracy
    return () => clearInterval(interval)
  }, [timerState])

  // Handle initial timer completion (first notification)
  useEffect(() => {
    if (isOvertime && !hasNotified && timerState) {
      setHasNotified(true)
      setWasOvertime(true)
      playBell()
      showNotification('Time\'s up!', timerState.focusText, notificationCommand)
    }
  }, [isOvertime, hasNotified, timerState, notificationCommand])

  // Handle bell ringing every time we cross into overtime (including after j/k adjustments)
  useEffect(() => {
    if (!timerState) return

    if (isOvertime && !wasOvertime) {
      // Just crossed into overtime (e.g., after adding time with k then it ran out again)
      playBell()
      setWasOvertime(true)
    } else if (!isOvertime && wasOvertime) {
      // Exited overtime (e.g., added time with k)
      setWasOvertime(false)
    }
  }, [isOvertime, wasOvertime, timerState])

  // Repeating bell every 20 seconds while in overtime
  useEffect(() => {
    if (isOvertime && timerState) {
      // Start repeating bell
      if (!bellIntervalRef.current) {
        bellIntervalRef.current = window.setInterval(playBell, BELL_REPEAT_INTERVAL)
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
  }, [isOvertime, timerState])

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
