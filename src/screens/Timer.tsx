import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext'
import { useSettings } from '../context/SettingsContext'
import { useTimerState } from '../hooks/useTimerState'
import { timerMachine, isUserTimer } from '../lib/timer-machine'
import { formatDuration } from '../lib/format';
import { nextCorner } from '../lib/corner';
import { platform, isTauri } from '../lib/platform';
import { executePrefillHook } from '../lib/shell-hooks';
import { Text } from '../components/catalyst/text'
import { CountdownDisplay } from '../components/CountdownDisplay';
import { parseCommand } from '../lib/command-parser'
import { Kbd } from '../components/Kbd';
import clsx from 'clsx'

const DEFAULT_COUNTDOWN_SECONDS = 300

export function Timer() {
  const { displayMode, setDisplayMode, setScreen } = useApp()
  const { timerState, heldStates, elapsed, remaining } = useTimerState()
  const { settings, updateSettings } = useSettings()

  // Edit mode state
  const [editMode, setEditMode] = useState(false)
  const [editInput, setEditInput] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [noPredictionWarning, setNoPredictionWarning] = useState(false)
  const [stackFullWarning, setStackFullWarning] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // Mirrors editInput so the async prefill can see what has been typed since it started
  const editInputRef = useRef('')
  editInputRef.current = editInput
  // Bumped on every prefill run so a slow one that lands late is ignored
  const prefillRunRef = useRef(0)

  // Live window-resize target + debounced persist, so rapid +/- presses compound
  // (tick-driven re-renders don't reset them) and key auto-repeat doesn't thrash
  // settings.json on every repeat.
  const resizeTargetRef = useRef<{ mode: 'normal' | 'small'; width: number; height: number } | null>(null)
  const resizePersistRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Parse command in real-time
  const parsed = useMemo(() => parseCommand(editInput), [editInput])

  // Clear warning when input changes
  useEffect(() => {
    setNoPredictionWarning(false)
  }, [editInput])

  /**
   * Fetch the prefill command's output into the input.
   *
   * Runs on every palette open, so it must never block: the input stays editable and a
   * result is dropped if it arrives after you have started typing (onlyIfEmpty), or if
   * a newer run has since started. The text arrives selected, so replacing it costs one
   * keystroke - which matters because on a push the prefilled intention is usually the
   * thing you are being interrupted from.
   */
  const runPrefill = useCallback(async ({ onlyIfEmpty }: { onlyIfEmpty: boolean }) => {
    if (!settings.prefillCommand) return
    const run = ++prefillRunRef.current
    setEditLoading(true)
    try {
      const result = await executePrefillHook(settings.prefillCommand)
      if (run !== prefillRunRef.current) return
      if (!result) return
      if (onlyIfEmpty && editInputRef.current !== '') return
      setEditInput(result)
      requestAnimationFrame(() => inputRef.current?.select())
    } finally {
      if (run === prefillRunRef.current) setEditLoading(false)
    }
  }, [settings.prefillCommand])

  const openPalette = useCallback(() => {
    setEditMode(true)
    setEditInput('')
    editInputRef.current = ''
    runPrefill({ onlyIfEmpty: true })
  }, [runPrefill])

  // Focus input when entering edit mode
  useEffect(() => {
    if (editMode) {
      inputRef.current?.focus()
    }
  }, [editMode])

  // The stack-full warning is transient: it answers one refused keypress.
  useEffect(() => {
    if (!stackFullWarning) return
    const timeout = setTimeout(() => setStackFullWarning(false), 4000)
    return () => clearTimeout(timeout)
  }, [stackFullWarning])

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

      // Resize the active window (normal or small) by a factor, keeping aspect
      // ratio, and re-apply the mode so it stays centered / pinned to its corner.
      const resizeActiveWindow = async (factor: number) => {
        if (!isTauri) return
        // zen mode is fullscreen — nothing to resize
        if (displayMode !== 'normal' && displayMode !== 'small') return

        // Minimums must match what the Settings screen enforces (Settings.tsx),
        // otherwise the keybinding can persist a size the settings form rejects.
        const [widthKey, heightKey, minW, minH] = displayMode === 'normal'
          ? ['normalWindowWidth', 'normalWindowHeight', 300, 200] as const
          : ['smallWindowWidth', 'smallWindowHeight', 200, 80] as const

        // Seed from the live target if we're still in the same resize burst,
        // otherwise from the committed settings.
        const seed = resizeTargetRef.current?.mode === displayMode
          ? resizeTargetRef.current
          : { width: settings[widthKey], height: settings[heightKey] }

        // Clamp the scale factor (not each dimension independently) so the aspect
        // ratio is preserved: keep both dimensions at/above their minimum and, when
        // the monitor size is known, at/below the screen.
        const minFactor = Math.max(minW / seed.width, minH / seed.height)
        const max = await platform.getMaxWindowSize()
        const maxFactor = max ? Math.min(max.width / seed.width, max.height / seed.height) : Infinity
        // The floor wins if the screen is somehow smaller than the minimum size.
        const clampedFactor = Math.min(Math.max(factor, minFactor), Math.max(minFactor, maxFactor))
        const width = Math.round(seed.width * clampedFactor)
        const height = Math.round(seed.height * clampedFactor)
        resizeTargetRef.current = { mode: displayMode, width, height }

        // Apply the geometry live for responsiveness...
        const next = { ...settings, [widthKey]: width, [heightKey]: height }
        if (displayMode === 'normal') await platform.setNormalMode(next)
        else await platform.setSmallMode(next)

        // ...but coalesce the settings write so auto-repeat persists only once.
        if (resizePersistRef.current) clearTimeout(resizePersistRef.current)
        resizePersistRef.current = setTimeout(() => {
          resizePersistRef.current = null
          resizeTargetRef.current = null
          void updateSettings({ [widthKey]: width, [heightKey]: height })
        }, 250)
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
            await platform.setSmallMode({ ...settings, corner: newCorner })
          } else {
            setDisplayMode('small');
          }
          break

        case 'enter': {
          e.preventDefault()
          // Enter finishes a real timer. Shift+Enter always starts a new one, which
          // holds the current timer if it is real and replaces it if it is the idle
          // countdown. Over the idle countdown both keys just open the palette.
          if (isUserTimer(timerState) && !e.shiftKey) {
            timerMachine.complete()
            break
          }
          // Normal mode first, either way: the palette lives there, and so does the
          // warning explaining a refusal - in corner or zen it would go unseen.
          if (displayMode !== 'normal') {
            setDisplayMode('normal')
          }
          if (isUserTimer(timerState) && timerMachine.getStack().length >= settings.maxStackDepth) {
            setStackFullWarning(true)
            break
          }
          openPalette()
          break
        }

        case 'q':
          // Bin the timer on screen, revealing whatever was held under it. On the idle
          // countdown this just restarts it, which is what q has always done.
          timerMachine.cancel()
          break

        case 's':
          setScreen('stats')
          break

        case ',':
          setScreen('settings')
          break

        case '?':
          await updateSettings({ scrambleTimer: !settings.scrambleTimer })
          break

        case '+':
        case '=':
          e.preventDefault()
          await resizeActiveWindow(1.25)
          break

        case '-':
        case '_':
          e.preventDefault()
          await resizeActiveWindow(0.8)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (resizePersistRef.current) clearTimeout(resizePersistRef.current)
    }
  }, [editMode, displayMode, settings, setDisplayMode, updateSettings, timerState, remaining, openPalette])

  const handleEditSubmit = useCallback((forceTimebox: boolean = false) => {
    // If input is empty, just close edit mode
    if (!editInput.trim()) {
      setEditMode(false)
      setNoPredictionWarning(false)
      return
    }

    // If no prediction and not forcing timebox, show warning first
    if (parsed.seconds === null && !forceTimebox && !noPredictionWarning) {
      setNoPredictionWarning(true)
      return
    }

    setEditMode(false)
    setNoPredictionWarning(false)

    // Only update if there's something to set
    if (parsed.intent || parsed.seconds !== null || forceTimebox) {
      // forceTimebox: treat any parsed duration as timebox, not prediction
      const hasPrediction = parsed.seconds !== null && !forceTimebox
      const tags = hasPrediction ? ['mode:predict'] : ['mode:timebox']

      // Calculate initial adjustment:
      // - For predictions: based on timer start percentage
      // - For timebox with explicit duration: use that duration
      // - For timebox without duration: keep the countdown you had dialed in, unless
      //   the current timer is real - that countdown belongs to it and it is about to
      //   go on hold with it, so the new timer starts from the default instead.
      let initialAdjustment: number
      if (hasPrediction) {
        initialAdjustment = Math.round(parsed.seconds! * (settings.timerStartPercentage / 100 - 1))
      } else if (parsed.seconds !== null) {
        initialAdjustment = parsed.seconds
      } else if (isUserTimer(timerState)) {
        initialAdjustment = DEFAULT_COUNTDOWN_SECONDS
      } else {
        initialAdjustment = remaining
      }

      // Holds the current timer if it is real, replaces it if it is the idle countdown
      timerMachine.push(
        parsed.intent,
        hasPrediction ? parsed.seconds : null,
        initialAdjustment,
        tags
      )
    }
  }, [editInput, parsed, settings.timerStartPercentage, remaining, noPredictionWarning, timerState])

  const handleEditCancel = useCallback(() => {
    setEditMode(false)
    setEditInput('')
    setNoPredictionWarning(false)
  }, [])

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Shift+Enter always starts as timebox (no prediction)
      handleEditSubmit(e.shiftKey)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleEditCancel()
    } else if (e.key === 'Tab' && settings.prefillCommand) {
      e.preventDefault()
      runPrefill({ onlyIfEmpty: false })
    }
  }, [handleEditSubmit, handleEditCancel, runPrefill, settings.prefillCommand])

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
    // Set reasonable min/max: between 1rem and 25vh, scales down gradually for longer text
    const intentFontSize = `max(1rem,  min(${250 / intentLength}vw, 20vh))`;

    return (
      <div className="flex flex-col items-center justify-center h-screen px-[2vw] py-[2vh]">
        {timerState.focusText && (
            <div className='w-full'>
              <p className="text-accent text-center font-medium overflow-x-hidden overflow-ellipsis whitespace-nowrap" style={{ fontSize: intentFontSize }}>
                {timerState.focusText}
              </p>
            </div>
        )}
        <CountdownDisplay
          remaining={remaining}
          accentColor={settings.accentColor}
          autoscale
          className="min-h-[66vh]!"
          scrambled={settings.scrambleTimer}
        />
      </div>
    )
  }

  // Normal mode: full UI with viewport-proportional sizing
  // Determine what to show in countdown: parsed seconds if available, otherwise current remaining
  const displayRemaining = editMode && parsed.seconds !== null ? parsed.seconds : remaining

  // Spell out what starting a timer will do to the one already running, by name, at the
  // moment of the decision - that is the whole "is this a push?" affordance.
  const heldOnStart = isUserTimer(timerState) ? timerState.focusText || 'this timer' : null
  const startLabel = heldOnStart
    ? `Start · hold "${truncate(heldOnStart, 24)}"`
    : 'Start with prediction'

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-4 select-none">
      <div className="flex flex-col items-center w-full ">
        {/* What is waiting underneath. Only while the palette is open: the rest of the
            time the marks at the bottom of the screen carry it, wordlessly. */}
        {editMode && heldStates.length > 0 && (
          <p className="text-sm text-zinc-500 mb-2 max-w-[90vw] truncate">
            On hold: {heldStates.map(s => s.focusText || 'Untitled').join(' · ')}
          </p>
        )}

        {/* Intent - either editable input or text display */}
        {editMode ? (
          <input
            ref={inputRef}
            type="text"
            value={editInput}
            onChange={(e) => setEditInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={editLoading ? "Prefilling…" : "I want to… 12m"}
            className={clsx(
              "text-[10vh] text-center font-medium min-h-[2em] max-w-[90vw]",
              "bg-transparent outline-none",
              "border-b-4",
              noPredictionWarning?
                (settings.accentColor !== 'amber')?
                  "border-amber-500/50 focus:border-amber-500" :
                  "border-red-500/50 focus:border-red-500" :
                "border-accent/50 focus:border-accent",
              "text-accent placeholder-zinc-600",
              "transition-colors"
            )}
            autoComplete="off"
            spellCheck={false}
          />
        ) : (
          <p className={clsx(
            "text-[10vh] text-center font-medium min-h-[2em] max-w-[90vw] overflow-x-hidden overflow-y-visible overflow-ellipsis whitespace-nowrap",
            timerState.focusText ? "text-accent" : "text-zinc-600"
          )}>
            {timerState.focusText || (isUserTimer(timerState) ? '' : 'Enter to set intent')}
          </p>
        )}

        {/* Warning when no prediction */}
        {noPredictionWarning && (
          <p className="text-amber-500 text-lg mt-2 text-center">
            No prediction: add one like <Kbd>15m</Kbd>, or <Kbd>Enter</Kbd> to continue without
          </p>
        )}

        {/* Refused push: the stack is full on purpose */}
        {stackFullWarning && (
          <p className="text-amber-500 text-lg mt-2 text-center">
            {settings.maxStackDepth} timers already — finish one with <Kbd>Enter</Kbd> or bin it
            with <Kbd>q</Kbd> first
          </p>
        )}

        {/* Big countdown - viewport proportional */}
        <CountdownDisplay
          remaining={displayRemaining}
          accentColor={settings.accentColor}
          className="h-[33vh]!"
          autoscale
          scrambled={settings.scrambleTimer}
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
              <Shortcut keys={['5m 30s']} label="Duration syntax" />
              <Shortcut keys={['Enter']} label={startLabel} />
              <Shortcut keys={['Shift', 'Enter']} label="Start without prediction" />
              {settings.prefillCommand && <Shortcut keys={['Tab']} label="Prefill" />}
            </>
          ) : (
            <>
              <Shortcut keys={['Tab']} label="Zen mode" />
              {isTauri && <Shortcut keys={['Space']} label="Toggle corner mode" />}
              <Shortcut keys={['j', 'k']} label="±1 minute" />
              <Shortcut keys={['0-9']} label="Set to X minutes" />
              <Shortcut keys={['J', 'K']} label="±5 minutes" />
              <Shortcut keys={['Shift', '0-9']} label="Set to 10×X minutes" />
              {isTauri && <Shortcut keys={['c']} label="Cycle corners" />}
              {isTauri && <Shortcut keys={['+', '-']} label="Resize window" />}
              <Shortcut keys={['q']} label={heldStates.length > 0 ? "Cancel, back to held" : "Cancel"} />
              <Shortcut keys={['s']} label="Stats" />
              <Shortcut keys={[',']} label="Settings" />
              <Shortcut keys={['Enter']} label={isUserTimer(timerState) ? "Complete" : "Set intent"} />
              {isUserTimer(timerState) && (
                <Shortcut keys={['Shift', 'Enter']} label="New timer, hold this one" />
              )}
              <Shortcut keys={['?']} label={settings.scrambleTimer ? "Unscramble timer" : "Scramble timer"} />
            </>
          )}
        </div>
      </div>

      {/* One mark per held timer: a count, no text, no clocks. Normal mode only -
          corner and zen keep every pixel for the timer on screen. */}
      {heldStates.length > 0 && (
        <div
          className="fixed bottom-3 left-0 right-0 flex justify-center gap-1.5"
          role="img"
          aria-label={`${heldStates.length} timer${heldStates.length > 1 ? 's' : ''} on hold`}
        >
          {heldStates.map((held, i) => (
            <span key={i} className="h-[3px] w-8 rounded-full bg-zinc-600" title={held.focusText} />
          ))}
        </div>
      )}
    </div>
  )
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text
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
