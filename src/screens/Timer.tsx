import { useState, useEffect, useCallback, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { formatCountdown, formatDuration } from '../lib/format'
import { appendSession, clearActiveSession } from '../lib/storage'
import { playBell, showNotification } from '../lib/sound'
import { setSmallMode, setNormalMode, toggleFullscreen, nextCorner } from '../lib/window'
import { Text } from '../components/catalyst/text'
import clsx from 'clsx'

const BELL_REPEAT_INTERVAL = 20000 // 20 seconds

export function Timer() {
  const {
    timerState,
    timerMode,
    corner,
    setTimerMode,
    setCorner,
    adjustTimer,
    completeTimer,
    cancelTimer,
  } = useApp()

  const [elapsed, setElapsed] = useState(0)
  const [hasNotified, setHasNotified] = useState(false)
  const [wasOvertime, setWasOvertime] = useState(false) // Track if we were in overtime
  const bellIntervalRef = useRef<number | null>(null)

  // Compute remaining time
  const predicted = timerState?.predictedSeconds ?? 0
  const adjustment = timerState?.adjustmentSeconds ?? 0
  const remaining = predicted + adjustment - elapsed
  const isOvertime = remaining < 0

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
      showNotification('Time\'s up!', timerState.focusText)
    }
  }, [isOvertime, hasNotified, timerState])

  // Handle bell ringing every time we cross into overtime (including after j/k adjustments)
  useEffect(() => {
    if (isOvertime && !wasOvertime && timerState) {
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

  // Handle complete/cancel actions
  const handleComplete = useCallback(async () => {
    if (!timerState) return

    // Stop bell
    if (bellIntervalRef.current) {
      clearInterval(bellIntervalRef.current)
      bellIntervalRef.current = null
    }

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

    // Reset window mode if needed
    if (timerMode !== 'normal') {
      await setNormalMode()
    }

    completeTimer()
  }, [timerState, elapsed, timerMode, completeTimer])

  const handleCancel = useCallback(async () => {
    if (!timerState) return

    // Stop bell
    if (bellIntervalRef.current) {
      clearInterval(bellIntervalRef.current)
      bellIntervalRef.current = null
    }

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

    // Reset window mode if needed
    if (timerMode !== 'normal') {
      await setNormalMode()
    }

    cancelTimer()
  }, [timerState, elapsed, timerMode, cancelTimer])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key.toLowerCase()) {
        case 'tab':
          e.preventDefault()
          if (timerMode === 'presentation') {
            setTimerMode('normal')
            await toggleFullscreen()
          } else if (timerMode === 'normal') {
            setTimerMode('presentation')
            await toggleFullscreen()
          }
          break

        case ' ':
          e.preventDefault()
          if (timerMode === 'small') {
            setTimerMode('normal')
            await setNormalMode()
          } else if (timerMode === 'normal') {
            setTimerMode('small')
            await setSmallMode(corner)
          }
          break

        case 'c':
          if (timerMode === 'small') {
            const newCorner = nextCorner(corner)
            setCorner(newCorner)
            await setSmallMode(newCorner)
          }
          break

        case 'j':
          adjustTimer(-60) // -1 minute
          break

        case 'k':
          adjustTimer(60) // +1 minute
          break

        case 'enter':
          await handleComplete()
          break

        case 'q':
          await handleCancel()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [timerMode, corner, setTimerMode, setCorner, adjustTimer, handleComplete, handleCancel])

  if (!timerState) {
    return (
      <div className="flex items-center justify-center h-full">
        <Text>No active timer</Text>
      </div>
    )
  }

  // Small mode: compact display with prominent intent
  if (timerMode === 'small') {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-2 select-none overflow-hidden">
        <p className="text-amber-400 text-base font-medium truncate max-w-full mb-1 px-2">
          {timerState.focusText}
        </p>
        <p
          className={clsx(
            'font-timer text-5xl font-bold tracking-tight',
            isOvertime ? 'text-red-500' : 'text-zinc-100'
          )}
        >
          {formatCountdown(remaining)}
        </p>
      </div>
    )
  }

  // Presentation mode: minimal display, viewport-proportional
  if (timerMode === 'presentation') {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-8 select-none bg-surface">
        <p className="text-zinc-200 text-[4vw] mb-[2vh] text-center max-w-[80vw] font-medium">
          {timerState.focusText}
        </p>
        <p
          className={clsx(
            'font-timer text-[20vw] font-bold tracking-tight leading-none',
            isOvertime ? 'text-red-500' : 'text-zinc-100'
          )}
        >
          {formatCountdown(remaining)}
        </p>
      </div>
    )
  }

  // Normal mode: full UI with viewport-proportional sizing
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 select-none">
      <div className="flex flex-col items-center w-full max-w-2xl">
        {/* Intent - prominent */}
        <p className="text-zinc-200 text-2xl md:text-3xl text-center mb-8 font-medium">
          {timerState.focusText}
        </p>

        {/* Big countdown - viewport proportional */}
        <p
          className={clsx(
            'font-timer text-[18vw] md:text-[12vw] font-bold tracking-tight leading-none',
            isOvertime ? 'text-red-500' : 'text-zinc-100'
          )}
        >
          {formatCountdown(remaining)}
        </p>

        {/* Elapsed / Predicted */}
        <p className="font-timer text-xl md:text-2xl mt-6">
          {formatDuration(elapsed)} / {formatDuration(predicted)}
        </p>

        {/* Shortcut hints */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mt-12">
          <Shortcut keys={['Tab']} label="Presentation mode" />
          <Shortcut keys={['Space']} label="Small corner mode" />
          <Shortcut keys={['j', 'k']} label="±1 minute" />
          <Shortcut keys={['c']} label="Cycle corners" />
          <Shortcut keys={['Enter']} label="Complete" />
          <Shortcut keys={['q']} label="Cancel" />
        </div>
      </div>
    </div>
  )
}

function Shortcut({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex gap-1">
        {keys.map(key => (
          <kbd
            key={key}
            className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-xs font-mono"
          >
            {key}
          </kbd>
        ))}
      </span>
      <Text className="text-sm">{label}</Text>
    </div>
  )
}
