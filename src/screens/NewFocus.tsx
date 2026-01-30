import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { useSettings } from '../context/SettingsContext';
import { parseTime } from '../lib/time-parser';
import { formatDuration } from '../lib/format';
import { Button } from '../components/catalyst/button';
import { Text } from '../components/catalyst/text';
import { ModeTabButton } from '../components/ModeTabButton';
import { COLOR_PALETTES } from '../lib/colors';
import confetti from 'canvas-confetti'
import clsx from 'clsx'

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


type TimerType = 'predict' | 'timebox' | 'ai-ab';

function BlankInput({
  value,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
  placeholder,
  inputRef,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  minWidth?: string;
  className?: string;
}) {
  const [width, setWidth] = useState('auto');
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
        onFocus={(e) => {
          e.target.select()
          onFocus?.()
        }}
        onBlur={onBlur}
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
  const { startTimer, showConfetti, clearConfetti } = useApp()
  const { settings } = useSettings()
  const [focusText, setFocusText] = useState('')
  const [timeInput, setTimeInput] = useState('')
  const [question, setQuestion] = useState(QUESTIONS[0])
  const [timerType, setTimerType] = useState<TimerType>('predict')
  const [focusedInput, setFocusedInput] = useState<'focus' | 'time' | null>('focus')
  const focusInputRef = useRef<HTMLInputElement>(null)
  const timeInputRef = useRef<HTMLInputElement>(null)

  const parsedSeconds = parseTime(timeInput)
  const isValid = focusText.trim() && parsedSeconds !== null && parsedSeconds > 0
  const isTimebox = timerType === 'timebox';

  // Pick a random question on mount
  useEffect(() => {
    setQuestion(QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]);
  }, [])

  // Initialize with default duration based on settings
  useEffect(() => {
    let duration: number | null = null;
    if (settings.defaultDurationMode === 'last') {
      duration = settings.lastUsedDuration;
    } else if (settings.defaultDurationMode === 'fixed') {
      duration = settings.defaultDurationSeconds;
    }

    if (duration !== null && duration > 0) {
      setTimeInput(formatDuration(duration));
    } else {
      setTimeInput('');
    }
  }, [settings.defaultDurationMode, settings.lastUsedDuration, settings.defaultDurationSeconds])

  // Initialize with last used timer type
  useEffect(() => {
    setTimerType(settings.lastUsedTimerType);
  }, [settings.lastUsedTimerType])

  // Fire confetti on mount if we just completed a session
  useEffect(() => {
    if (showConfetti) {
      const duration = 2000
      const end = Date.now() + duration

      const accentPalette = COLOR_PALETTES[settings.accentColor]
      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: [accentPalette.base, accentPalette.hover, '#22c55e', '#3b82f6'],
        })
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: [accentPalette.base, accentPalette.hover, '#22c55e', '#3b82f6'],
        })

        if (Date.now() < end) {
          requestAnimationFrame(frame)
        }
      }
      frame()

      const timeout = setTimeout(clearConfetti, duration)
      return () => clearTimeout(timeout)
    }
  }, [showConfetti, clearConfetti, settings.accentColor])

  // Focus the input on mount
  useEffect(() => {
    focusInputRef.current?.focus()
  }, [])

  // Handle Enter key globally to focus intention input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && focusedInput === null) {
        e.preventDefault()
        focusInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusedInput])

  const handleStart = async () => {
    if (!isValid || parsedSeconds === null) return

    // TODO: Consider renaming tag prefix from 'mode:' to 'type:' once we have a migration system
    // Tags use 'mode:' prefix for backwards compatibility with existing session data
    await startTimer(focusText.trim(), parsedSeconds, [`mode:${timerType}`], timerType)
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
      <div className="w-full max-w-md lg:max-w-xl 2xl:scale-175 xl:scale-125">
        {/* Timer type tabs */}
        <div className="flex gap-2 mb-8">
          <ModeTabButton
            mode="predict"
            currentMode={timerType}
            onClick={() => setTimerType('predict')}
            title="Prediction mode"
            emoji="⏱️"
            label="Predict"
            activeColor={settings.accentColor}
          />
          <ModeTabButton
            mode="timebox"
            currentMode={timerType}
            onClick={() => setTimerType('timebox')}
            title="Time box mode (no prediction)"
            emoji="🎯"
            label="Time Box"
            activeColor="emerald"
          />
          {settings.enableAiProductivityExperiment && (
            <ModeTabButton
              mode="ai-ab"
              currentMode={timerType}
              onClick={() => setTimerType('ai-ab')}
              title="AI Productivity Experiment"
              emoji="🎲"
              label="AI Productivity"
              activeColor="purple"
            />
          )}
        </div>

        {/* Question */}
        <p className="text-xl lg:text-2xl font-medium text-zinc-400 mb-2">
          {question}
        </p>

        {/* Fill in the blanks sentence */}
        <p className="text-3xl lg:text-4xl font-medium text-zinc-100 leading-relaxed mb-4">
          I want to{' '}
          <BlankInput
            value={focusText}
            onChange={setFocusText}
            onKeyDown={handleFocusKeyDown}
            onFocus={() => setFocusedInput('focus')}
            onBlur={() => setFocusedInput(null)}
            placeholder="write the intro"
            inputRef={focusInputRef}
            className="max-w-[90%]"
          />
          .<br />
          {isTimebox ? (
            <>I'll focus exclusively on it<br />for{' '}</>
          ) : (
            <>It's 80% likely I'll be done<br />in{' '}</>
          )}
          <BlankInput
            value={timeInput}
            onChange={setTimeInput}
            onKeyDown={handleTimeKeyDown}
            onFocus={() => setFocusedInput('time')}
            onBlur={() => setFocusedInput(null)}
            placeholder="25m"
            inputRef={timeInputRef}
          />
          .
        </p>

        {/* Hints */}
        <Text className="text-sm h-5 text-center mb-2">
          {timeInput && parsedSeconds === null && (
            <span className="text-red-400">Invalid duration format. Try "25m", "1h 30m", or "45:00"</span>
          )}
        </Text>

        {/* Start button */}
        <div>
          <Button
            color={settings.accentColor}
            className="w-full py-3 text-lg"
            disabled={!isValid}
            onClick={handleStart}
          >
            Start Focus
          </Button>
          <Text className="text-center text-xs mt-4 text-zinc-400">
            {focusedInput === 'focus' && (
              <>Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">Enter</kbd> to edit duration</>
            )}
            {focusedInput === 'time' && (
              <>Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">Enter</kbd> to start</>
            )}
            {focusedInput === null && (
              <>Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">Enter</kbd> to edit intention</>
            )}
            {parsedSeconds !== null && parsedSeconds > 0 && (
              <> <span className="px-2">·</span> Done at {getCompletionTime(parsedSeconds)}</>
            )}
          </Text>
        </div>
      </div>
    </div>
  )
}
