import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { useSettings } from '../context/SettingsContext';
import { parseTime, formatTimePreview } from '../lib/time-parser';
import { Button } from '../components/catalyst/button';
import { Text } from '../components/catalyst/text';
import { saveActiveSession } from '../lib/storage';
import confetti from 'canvas-confetti'
import clsx from 'clsx'

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${mins}m`;
}

function getCompletionTime(seconds: number): string {
  const completionDate = new Date(Date.now() + seconds * 1000);
  const hours = completionDate.getHours();
  const minutes = completionDate.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${ampm}`;
}

const QUESTIONS = [
  'What will you accomplish?',
  'What is important right now?',
  'What were you avoiding until now?',
  "What's the right thing to do?",
  'What is urgent?',
  "What's a small thing you'll be proud to have done?",
  "What are you excited about?",
  "What's the best use of your time right now?",
  "What's the next step?",
  'How can you make progress today?',
  'What will you be proud of at your next break?',
  'Where does your heart tell you to go?',
]


type SessionMode = 'predict' | 'timebox' | 'ai-ab';

function BlankInput({
  value,
  onChange,
  onKeyDown,
  placeholder,
  inputRef,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  minWidth?: string;
  className?: string;
}) {
  const [width, setWidth] = useState('0');
  const measureRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (measureRef.current) {
      const measured = measureRef.current.offsetWidth;
      setWidth(`${measured + 8}px`);
    }
  }, [value, placeholder]);

  return (
    <span className={clsx("inline-block relative", className)}>
      <span ref={measureRef} className="invisible absolute whitespace-pre font-inherit text-3xl lg:text-4xl font-medium truncate max-w-xl">
        {value || placeholder}
      </span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        style={{ width }}
        className="bg-transparent border-0 border-b-2 border-zinc-600 focus:border-accent outline-none
                   font-inherit px-1 transition-colors placeholder:text-zinc-600 text-accent max-w-full"
      />
    </span>
  );
}

export function NewFocus() {
  const { startTimer, showConfetti, clearConfetti, lastUsedDuration } = useApp()
  const { settings } = useSettings()
  const [focusText, setFocusText] = useState('')
  const [timeInput, setTimeInput] = useState('')
  const [question, setQuestion] = useState(QUESTIONS[0])
  const [mode, setMode] = useState<SessionMode>('predict')
  const focusInputRef = useRef<HTMLInputElement>(null)
  const timeInputRef = useRef<HTMLInputElement>(null)

  const parsedSeconds = parseTime(timeInput)
  const isValid = focusText.trim() && parsedSeconds !== null && parsedSeconds > 0
  const isTimebox = mode === 'timebox';

  // Pick a random question on mount
  useEffect(() => {
    setQuestion(QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]);
  }, [])

  // Initialize with last used duration
  useEffect(() => {
    setTimeInput(formatTime(lastUsedDuration));
  }, [lastUsedDuration])

  // Fire confetti on mount if we just completed a session
  useEffect(() => {
    if (showConfetti) {
      const duration = 2000
      const end = Date.now() + duration

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: ['#f59e0b', '#fbbf24', '#22c55e', '#3b82f6'],
        })
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: ['#f59e0b', '#fbbf24', '#22c55e', '#3b82f6'],
        })

        if (Date.now() < end) {
          requestAnimationFrame(frame)
        }
      }
      frame()

      const timeout = setTimeout(clearConfetti, duration)
      return () => clearTimeout(timeout)
    }
  }, [showConfetti, clearConfetti])

  // Focus the input on mount
  useEffect(() => {
    focusInputRef.current?.focus()
  }, [])

  const handleStart = async () => {
    if (!isValid || parsedSeconds === null) return

    // Save active session for recovery
    try {
      await saveActiveSession({
        startTime: new Date().toISOString(),
        focusText: focusText.trim(),
        predictedSeconds: parsedSeconds,
      })
    } catch (err) {
      console.error('Failed to save session data:', err)
    }

    await startTimer(focusText.trim(), parsedSeconds, [`mode:${mode}`])
  }

  const handleFocusKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      timeInputRef.current?.focus()
    }
  }

  const handleTimeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (isValid) {
        handleStart()
      }
    }
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8">
      <div className="w-full max-w-md lg:max-w-xl">
        {/* Mode tabs */}
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setMode('predict')}
            title="Prediction mode"
            className={clsx(
              "h-8 rounded-full flex items-center justify-center transition-all text-sm",
              mode === 'predict'
                ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50 px-3 gap-1.5"
                : "w-8 text-zinc-600/70 hover:text-zinc-500 hover:bg-zinc-800"
            )}
          >
            <span>⏱️</span>
            {mode === 'predict' && <span className="text-xs font-medium">Predict</span>}
          </button>
          <button
            onClick={() => setMode('timebox')}
            title="Time box mode (no prediction)"
            className={clsx(
              "h-8 rounded-full flex items-center justify-center transition-all text-sm",
              mode === 'timebox'
                ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50 px-3 gap-1.5"
                : "w-8 text-zinc-600/70 hover:text-zinc-500 hover:bg-zinc-800"
            )}
          >
            <span>🎯</span>
            {mode === 'timebox' && <span className="text-xs font-medium">Time Box</span>}
          </button>
          {settings.enableAiProductivityExperiment && (
            <button
              onClick={() => setMode('ai-ab')}
              title="AI Productivity Experiment"
              className={clsx(
                "h-8 rounded-full flex items-center justify-center transition-all text-sm",
                mode === 'ai-ab'
                  ? "bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/50 px-3 gap-1.5"
                  : "w-8 text-zinc-600/70 hover:text-zinc-500 hover:bg-zinc-800"
              )}
            >
              <span>🎲</span>
              {mode === 'ai-ab' && <span className="text-xs font-medium">AI Productivity</span>}
            </button>
          )}
        </div>

        {/* Question */}
        <p className="text-xl lg:text-2xl font-medium text-zinc-400 mb-4">
          {question}
        </p>

        {/* Fill in the blanks sentence */}
        <p className="text-3xl lg:text-4xl font-medium text-zinc-100 leading-relaxed mb-12">
          I want to{' '}
          <BlankInput
            value={focusText}
            onChange={setFocusText}
            onKeyDown={handleFocusKeyDown}
            placeholder="write the intro"
            inputRef={focusInputRef}
            className="max-w-[90%]"
          />
          .<br />
          {isTimebox ? (
            <>I'll focus for{' '}</>
          ) : (
            <>It's 80% likely I'll be done<br />in{' '}</>
          )}
          <BlankInput
            value={timeInput}
            onChange={setTimeInput}
            onKeyDown={handleTimeKeyDown}
            placeholder="25m"
            inputRef={timeInputRef}
          />
          .
        </p>

        {/* Hints */}
        <Text className="text-sm h-5 text-center">
          {parsedSeconds !== null && parsedSeconds > 0 && (
            <>
              <span>Parsed as {formatTimePreview(parsedSeconds)}</span>
              <span className="px-2">·</span>
              <span>Done at {getCompletionTime(parsedSeconds)}</span>
            </>
          )}
          {timeInput && parsedSeconds === null && (
            <span className="text-red-400">Invalid duration format. Try "25m", "1h 30m", or "45:00"</span>
          )}
        </Text>

        {/* Start button */}
        <div className="pt-4">
          <Button
            color="amber"
            className="w-full py-3 text-lg"
            disabled={!isValid}
            onClick={handleStart}
          >
            Start Focus
          </Button>
          <Text className="text-center text-xs mt-2 text-zinc-400">
            Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">Enter</kbd> to start
          </Text>
        </div>
      </div>
    </div>
  )
}
