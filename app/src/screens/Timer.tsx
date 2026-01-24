import { useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { useSettings } from '../context/SettingsContext'
import { formatCountdown, formatDuration } from '../lib/format'
import { setSmallMode, setNormalMode, nextCorner } from '../lib/window';
import { Text } from '../components/catalyst/text'
import clsx from 'clsx'

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
    elapsed,
    remaining,
    isOvertime,
  } = useApp()

  const { settings } = useSettings()
  const predicted = timerState?.predictedSeconds ?? 0

  // Keyboard shortcuts
  const handleComplete = useCallback(async () => {
    await completeTimer()
  }, [completeTimer])

  const handleCancel = useCallback(async () => {
    await cancelTimer()
  }, [cancelTimer])

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key.toLowerCase()) {
        case 'tab':
          e.preventDefault()
          if (timerMode === 'zen') {
            setTimerMode('normal')
          } else if (timerMode === 'normal') {
            setTimerMode('zen');
          } else if (timerMode === 'small') {
            setTimerMode('zen')
          }
          break

        case ' ':
          e.preventDefault()
          if (timerMode === 'small') {
            setTimerMode('normal')
            await setNormalMode(settings)
          } else if (timerMode === 'normal') {
            setTimerMode('small')
            await setSmallMode(corner, settings)
          } else if (timerMode === 'zen') {
            setTimerMode('small');
            await setSmallMode(corner, settings)
          }
          break

        case 'c':
          if (timerMode === 'small') {
            const newCorner = nextCorner(corner)
            setCorner(newCorner)
            await setSmallMode(newCorner, settings)
          } else {
            setTimerMode('small');
            await setSmallMode(corner, settings)
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
  }, [timerMode, corner, settings, setTimerMode, setCorner, adjustTimer, handleComplete, handleCancel])

  if (!timerState) {
    return (
      <div className="flex items-center justify-center h-full">
        <Text>No active timer</Text>
      </div>
    )
  }

  // Zen and Small modes: minimal display with prominent intent
  if (timerMode === 'zen' || timerMode === 'small') {
    const countdown = formatCountdown(remaining);
    const countdownLength = countdown.length;

    // First is to size wrt the height of the screen, second is to make sure there's enough space for each digit
    // All the numbers are magic. You can try to find better, but test well.
    const countDownFontSize = `min(62vh,${100/(countdownLength/1.5)}vw)`;
    // First is to take the rest of the vertical space, second is to keep it smaller than the countdown
    const intentFontSize = `min(calc(80vh - ${countDownFontSize}), ${countDownFontSize} * 0.3)`;

    return (
      <div className="flex flex-col items-center justify-center h-screen p-1 xs:p-4 select-none overflow-hidden bg-surface">
        <p className="text-accent mb-[2vh] text-center max-w-[80vw] font-medium overflow-x-hidden overflow-ellipsis whitespace-nowrap" style={{ fontSize: intentFontSize }}>
          {timerState.focusText}
        </p>
        <p
          className={clsx(
            'font-timer font-bold tracking-tight leading-none',
            isOvertime ? 'text-red-500' : 'text-zinc-100'
          )}
          style={{ fontSize: countDownFontSize }}
        >
          {countdown}
        </p>
      </div>
    )
  }

  // Normal mode: full UI with viewport-proportional sizing
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 select-none">
      <div className="flex flex-col items-center w-full max-w-2xl">
        {/* Intent - prominent */}
        <p className="text-accent text-2xl md:text-3xl text-center mb-8 font-medium">
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
          <Shortcut keys={['Tab']} label="Zen mode" />
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
