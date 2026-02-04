import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext'
import { useSettings } from '../context/SettingsContext'
import { useTimerState } from '../hooks/useTimerState'
import { timerMachine } from '../lib/timer-machine'
import { formatDuration } from '../lib/format';
import { nextCorner, setSmallMode } from '../lib/window';
import { executePrefillHook } from '../lib/settings';
import { Text } from '../components/catalyst/text'
import { CountdownDisplay } from '../components/CountdownDisplay';
import { parseCommand } from '../lib/command-parser'
import { Kbd } from '../components/Kbd';
import clsx from 'clsx'

const DEFAULT_COUNTDOWN_SECONDS = 300

export function Timer() {
  const { displayMode, setDisplayMode } = useApp()
  const { timerState, elapsed, remaining } = useTimerState()
  const { settings, updateSettings } = useSettings()

  // Edit mode state
  const [editMode, setEditMode] = useState(false)
  const [editInput, setEditInput] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Parse command in real-time
  const parsed = useMemo(() => parseCommand(editInput), [editInput])

  const handlePrefill = useCallback(async () => {
    if (!settings.prefillCommand || editLoading) return
    setEditLoading(true)
    try {
      const result = await executePrefillHook(settings.prefillCommand)
      if (result) {
        setEditInput(result)
      }
    } finally {
      setEditLoading(false)
    }
  }, [settings.prefillCommand, editLoading])

  // Focus input when entering edit mode
  useEffect(() => {
    if (editMode && !editLoading) {
      inputRef.current?.focus()
    }
  }, [editMode, editLoading])

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignore if typing in an input (e.g., edit mode input field)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // If in edit mode, only Enter key handled here (to open edit mode)
      // All other keys disabled when editing
      if (editMode) {
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
            // Prevent corner-to-zen transition
            setDisplayMode('normal')
          }
          break

        case ' ':
          e.preventDefault()
          if (displayMode === 'small') {
            setDisplayMode('normal')
          } else {
            setDisplayMode('small');
          }
          break

        case 'c':
          if (displayMode === 'small') {
            const newCorner = nextCorner(settings.corner);
            await updateSettings({ corner: newCorner });
            await setSmallMode({ ...settings, corner: newCorner })
          } else {
            setDisplayMode('small');
          }
          break

        case 'enter':
          e.preventDefault()
          // Enter edit mode only if there's no focus AND no prediction
          // Otherwise, complete the timer (which shows completion screen)
          if (!timerState?.focusText && timerState?.predictedSeconds === null) {
            // Ensure we're in normal mode when entering edit mode
            if (displayMode !== 'normal') {
              setDisplayMode('normal')
            }
            setEditMode(true)
            setEditInput('')
            // Shift+Enter triggers prefill if command is configured
            if (e.shiftKey && settings.prefillCommand) {
              handlePrefill()
            }
          } else {
            timerMachine.complete()
          }
          break

        case 'q':
          // Reset to default countdown (cancel any running timer)
          timerMachine.start('', null, DEFAULT_COUNTDOWN_SECONDS, [], 'cancel')
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editMode, displayMode, settings, setDisplayMode, updateSettings, timerState, remaining, handlePrefill])

  const handleEditSubmit = useCallback(() => {
    setEditMode(false)
    // Only update if there's something to set
    if (parsed.intent || parsed.seconds !== null) {
      const hasPrediction = parsed.seconds !== null
      const tags = hasPrediction ? ['mode:predict'] : ['mode:timebox']

      // Calculate initial adjustment based on timer start percentage (prediction mode only)
      const initialAdjustment = hasPrediction
        ? Math.round(parsed.seconds! * (settings.timerStartPercentage / 100 - 1))
        : DEFAULT_COUNTDOWN_SECONDS

      // Cancel previous timer when starting new task
      timerMachine.start(parsed.intent, parsed.seconds, initialAdjustment, tags, 'cancel')
    }
  }, [parsed, settings.timerStartPercentage])

  const handleEditCancel = useCallback(() => {
    setEditMode(false)
    setEditInput('')
  }, [])

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleEditSubmit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleEditCancel()
    }
  }, [handleEditSubmit, handleEditCancel])

  if (!timerState) {
    return (
      <div className="flex items-center justify-center h-full">
        <Text>No active timer</Text>
      </div>
    )
  }

  // Zen and Small display modes: minimal display with prominent intent
  if (displayMode === 'zen' || displayMode === 'small') {
    const intentLength = timerState.focusText?.length || 1;
    const intentFontSize = `min(25vh, ${250 / intentLength}vh)`;

    return (
      <div className="flex flex-col items-center justify-center h-screen px-[2vw] py-[2vh]">
        {timerState.focusText && (
            <p className="text-accent text-center max-w-full font-medium overflow-hidden overflow-ellipsis whitespace-nowrap" style={{ fontSize: intentFontSize }}>
              {timerState.focusText}
            </p>
        )}
        <CountdownDisplay
          remaining={remaining}
          accentColor={settings.accentColor}
          autoscale
          className="min-h-[66vh]!"
        />
      </div>
    )
  }

  // Normal mode: full UI with viewport-proportional sizing
  // Determine what to show in countdown: parsed seconds if available, otherwise current remaining
  const displayRemaining = editMode && parsed.seconds !== null ? parsed.seconds : remaining

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-4 select-none">
      <div className="flex flex-col items-center w-full ">
        {/* Intent - either editable input or text display */}
        {editMode ? (
          <input
            ref={inputRef}
            type="text"
            value={editInput}
            onChange={(e) => setEditInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={editLoading ? "Prefilling…" : "I want to… 12m"}
            disabled={editLoading}
            className={clsx(
              "text-[10vh] text-center font-medium min-h-[2em] max-w-[90vw]",
              "bg-transparent outline-none",
              "border-b-4 border-accent/50 focus:border-accent",
              "text-accent placeholder-zinc-600",
              "transition-colors",
              editLoading && "opacity-50 cursor-not-allowed"
            )}
            autoComplete="off"
            spellCheck={false}
          />
        ) : (
          <p className={clsx(
            "text-[10vh] text-center font-medium min-h-[2em] max-w-[90vw] overflow-hidden overflow-ellipsis whitespace-nowrap",
            timerState.focusText ? "text-accent" : "text-zinc-600"
          )}>
            {timerState.focusText || 'Enter to set intent'}
          </p>
        )}

        {/* Big countdown - viewport proportional */}
        <CountdownDisplay
          remaining={displayRemaining}
          accentColor={settings.accentColor}
          className="h-[33vh]!"
          autoscale
        />

        {/* Elapsed / Predicted - show different format in edit mode */}
        {editMode && parsed.seconds !== null ? (
          <p className="text-xl md:text-2xl mt-6">
            It's 80% likely I'll be done in <span className="text-accent font-medium">{formatDuration(parsed.seconds)}</span>
          </p>
        ) : timerState.predictedSeconds !== null && (
          <p className="text-xl md:text-2xl mt-6">
            {formatDuration(elapsed)} / {formatDuration(timerState.predictedSeconds)} predicted
          </p>
        )}

        {/* Shortcut hints - different when in edit mode */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mt-12 max-w-2xl">
          {editMode ? (
            <>
              <Shortcut keys={['Esc']} label="Cancel" />
              <Shortcut keys={['Enter']} label="Start timer" />
              <Shortcut keys={['5m 30s']} label="Predict duration" />
              <Shortcut keys={['12']} label="Predict minutes shorthand" />
            </>
          ) : (
            <>
              <Shortcut keys={['Tab']} label="Zen mode" />
              <Shortcut keys={['Space']} label="Toggle corner mode" />
              <Shortcut keys={['j', 'k']} label="±1 minute" />
              <Shortcut keys={['0-9']} label="Set to X minutes" />
              <Shortcut keys={['J', 'K']} label="±5 minutes" />
              <Shortcut keys={['Shift', '0-9']} label="Set to 10×X minutes" />
              <Shortcut keys={['c']} label="Cycle corners" />
              <Shortcut keys={['q']} label="Cancel" />
              <Shortcut keys={['Enter']} label={timerState.focusText ? "Complete" : "Set intent"} />
              {settings.prefillCommand && (
                <Shortcut keys={['Shift', 'Enter']} label="Set intent (prefill)" />
              )}
            </>
          )}
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
          <Kbd key={key}>{key}</Kbd>
        ))}
      </span>
      <Text className="text-sm">{label}</Text>
    </div>
  )
}
