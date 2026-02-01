import { useEffect, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext'
import { useSettings } from '../context/SettingsContext'
import { useTimerState } from '../hooks/useTimerState'
import { timerMachine } from '../lib/timer-machine'
import { formatCountdown, formatDuration } from '../lib/format'
import { setSmallMode, setNormalMode, nextCorner } from '../lib/window';
import { Text } from '../components/catalyst/text'
import { CommandPalette } from '../components/CommandPalette'
import { type ParsedCommand } from '../lib/command-parser'
import clsx from 'clsx'

const DEFAULT_COUNTDOWN_SECONDS = 300

export function Timer() {
  const { displayMode, setDisplayMode } = useApp()
  const { timerState, elapsed, remaining, isOvertime } = useTimerState()
  const { settings, updateSettings } = useSettings()

  // Command palette state
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignore if typing in an input (e.g., command palette)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Handle digits (0-9) for setting timer duration
      // Use e.code to detect physical key regardless of Shift state
      const digitMatch = e.code.match(/^Digit(\d)$/)
      if (digitMatch) {
        e.preventDefault()
        if (!timerState) return

        const digit = parseInt(digitMatch[1])
        const minutes = e.shiftKey ? digit * 10 : digit
        const targetSeconds = minutes * 60
        // Calculate adjustment needed: delta = target_remaining - current_remaining
        const delta = targetSeconds - remaining
        timerMachine.adjust(delta)
        return
      }

      // Handle j/k case-sensitively: lowercase = ±1 min, uppercase (Shift+j/k) = ±5 min
      if (e.key === 'j') {
        timerMachine.adjust(-60) // -1 minute
        return
      }
      if (e.key === 'k') {
        timerMachine.adjust(60) // +1 minute
        return
      }
      if (e.key === 'J') {
        timerMachine.adjust(-300) // -5 minutes
        return
      }
      if (e.key === 'K') {
        timerMachine.adjust(300) // +5 minutes
        return
      }

      switch (e.key.toLowerCase()) {
        case 'tab':
          e.preventDefault()
          if (displayMode === 'zen') {
            setDisplayMode('normal')
          } else if (displayMode === 'normal') {
            setDisplayMode('zen');
          } else if (displayMode === 'small') {
            setDisplayMode('zen')
          }
          break

        case ' ':
          e.preventDefault()
          if (displayMode === 'small') {
            setDisplayMode('normal')
            await setNormalMode(settings)
          } else if (displayMode === 'normal') {
            setDisplayMode('small')
            await setSmallMode(settings)
          } else if (displayMode === 'zen') {
            setDisplayMode('small');
            await setSmallMode(settings)
          }
          break

        case 'c':
          if (displayMode === 'small') {
            const newCorner = nextCorner(settings.corner);
            await updateSettings({ corner: newCorner });
            await setSmallMode({ ...settings, corner: newCorner })
          } else {
            setDisplayMode('small');
            await setSmallMode(settings)
          }
          break

        case 'enter':
          e.preventDefault()
          // If there's an intent set, complete the timer
          // Otherwise, open the command palette
          if (timerState?.focusText) {
            timerMachine.complete()
          } else {
            // If in small mode, transition to normal mode when opening palette
            if (displayMode === 'small') {
              setDisplayMode('normal')
              await setNormalMode(settings)
            }
            setPaletteOpen(true)
          }
          break

        case 'q':
          timerMachine.cancel()
          // Reset to default countdown
          timerMachine.start('', null, DEFAULT_COUNTDOWN_SECONDS, [])
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [displayMode, settings, setDisplayMode, updateSettings, timerState, remaining])

  const handlePaletteSubmit = useCallback((parsed: ParsedCommand) => {
    setPaletteOpen(false)
    // Only update if there's something to set
    if (parsed.intent || parsed.seconds !== null) {
      const hasPrediction = parsed.seconds !== null
      const tags = hasPrediction ? ['mode:predict'] : ['mode:timebox']

      // Calculate initial adjustment based on timer start percentage (prediction mode only)
      const initialAdjustment = hasPrediction
        ? Math.round(parsed.seconds! * (settings.timerStartPercentage / 100 - 1))
        : DEFAULT_COUNTDOWN_SECONDS

      timerMachine.start(parsed.intent, parsed.seconds, initialAdjustment, tags)
    }
  }, [settings.timerStartPercentage])

  const handlePaletteClose = useCallback(() => {
    setPaletteOpen(false)
  }, [])

  if (!timerState) {
    return (
      <div className="flex items-center justify-center h-full">
        <Text>No active timer</Text>
      </div>
    )
  }

  // Zen and Small display modes: minimal display with prominent intent
  if (displayMode === 'zen' || displayMode === 'small') {
    const countdown = formatCountdown(remaining);
    const countdownLength = countdown.length;

    // First is to size wrt the height of the screen, second is to make sure there's enough space for each digit
    // All the numbers are magic. You can try to find better, but test well.
    const countDownFontSize = `min(62vh,${100/(countdownLength/1.5)}vw)`;
    // First is to take the rest of the vertical space, second is to keep it smaller than the countdown
    const intentFontSize = `min(calc(80vh - ${countDownFontSize}), ${countDownFontSize} * 0.3)`;

    return (
      <div className="flex flex-col items-center justify-center h-screen p-1 xs:p-4 select-none overflow-hidden bg-surface">
        {timerState.focusText && (
          <p className="text-accent mb-[2vh] text-center max-w-[80vw] font-medium overflow-x-hidden overflow-ellipsis whitespace-nowrap" style={{ fontSize: intentFontSize }}>
            {timerState.focusText}
          </p>
        )}
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
    <>
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 select-none">
        <div className="flex flex-col items-center w-full max-w-2xl">
          {/* Intent - prominent (or placeholder if none) */}
          <p className={clsx(
            "text-2xl md:text-3xl text-center mb-8 font-medium min-h-[2em]",
            timerState.focusText ? "text-accent" : "text-zinc-600"
          )}>
            {timerState.focusText || 'Press Enter to set intent'}
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

          {/* Elapsed / Predicted - only show if there's a prediction */}
          {timerState.predictedSeconds !== null && (
            <p className="text-xl md:text-2xl mt-6">
              {formatDuration(elapsed)} / {formatDuration(timerState.predictedSeconds)} predicted
            </p>
          )}

          {/* Shortcut hints */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mt-12">
            <Shortcut keys={['Tab']} label="Zen mode" />
            <Shortcut keys={['Space']} label="Toggle corner mode" />
            <Shortcut keys={['j', 'k']} label="±1 minute" />
            <Shortcut keys={['0-9']} label="Set to X minutes" />
            <Shortcut keys={['J', 'K']} label="±5 minutes" />
            <Shortcut keys={['Shift', '0-9']} label="Set to 10×X minutes" />
            <Shortcut keys={['c']} label="Cycle corners" />
            <Shortcut keys={['q']} label="Cancel" />
            <Shortcut keys={['Enter']} label={timerState.focusText ? "Complete" : "Set intent"} />
          </div>
        </div>
      </div>

      {/* Command Palette Overlay */}
      {paletteOpen && (
        <CommandPalette
          onSubmit={handlePaletteSubmit}
          onClose={handlePaletteClose}
        />
      )}
    </>
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
