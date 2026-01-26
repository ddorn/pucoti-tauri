import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { parseTime, formatTimePreview } from '../lib/time-parser'
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

const SPRINT_QUESTIONS = [
  'What do you want to focus on?',
  'What deserves your full attention?',
  'What will you work on without distraction?',
]

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

// ============================================================================
// DESIGN VARIANTS - Toggle between these to compare
// ============================================================================

type DesignVariant = 'original' | 'pills' | 'text-links' | 'segmented' | 'icons' | 'icon-tabs' | 'discreet-tabs' | 'underline-tabs';
type SessionMode = 'predict' | 'sprint' | 'ai-ab';

interface DesignProps {
  focusText: string;
  setFocusText: (v: string) => void;
  timeInput: string;
  setTimeInput: (v: string) => void;
  question: string;
  parsedSeconds: number | null;
  isValid: boolean;
  handleStart: () => void;
  focusInputRef: React.RefObject<HTMLInputElement | null>;
  timeInputRef: React.RefObject<HTMLInputElement | null>;
  handleFocusKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleTimeKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  // Mode state for designs that need it
  mode: SessionMode;
  setMode: (m: SessionMode) => void;
  aiEnabled: boolean;
  setAiEnabled: (v: boolean) => void;
  sprintQuestion: string;
}

// Original design (current)
function DesignOriginal(props: DesignProps) {
  const { focusText, setFocusText, timeInput, setTimeInput, question, parsedSeconds, isValid, handleStart, focusInputRef, timeInputRef, handleFocusKeyDown, handleTimeKeyDown } = props;

  return (
    <div className="w-full max-w-md lg:max-w-xl">
      <p className="text-xl lg:text-2xl font-medium text-zinc-400 mb-4">{question}</p>
      <p className="text-3xl lg:text-4xl font-medium text-zinc-100 leading-relaxed mb-12">
        I want to{' '}
        <BlankInput value={focusText} onChange={setFocusText} onKeyDown={handleFocusKeyDown} placeholder="write the intro" inputRef={focusInputRef} className="max-w-[90%]" />
        .<br /> It's 80% likely I'll be done<br />in{' '}
        <BlankInput value={timeInput} onChange={setTimeInput} onKeyDown={handleTimeKeyDown} placeholder="25m" inputRef={timeInputRef} />
        .
      </p>
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
      <div className="pt-4">
        <Button color="amber" className="w-full py-3 text-lg" disabled={!isValid} onClick={handleStart}>
          Start Focus
        </Button>
        <Text className="text-center text-xs mt-2 text-zinc-400">
          Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">Enter</kbd> to start
        </Text>
      </div>
    </div>
  );
}

// Design A: Pill buttons below (original)
function DesignButtonsBelow(props: DesignProps) {
  const { focusText, setFocusText, timeInput, setTimeInput, question, parsedSeconds, isValid, handleStart, focusInputRef, timeInputRef, handleFocusKeyDown, handleTimeKeyDown, mode, setMode, sprintQuestion } = props;

  const isSprint = mode === 'sprint';
  const isAiAb = mode === 'ai-ab';

  return (
    <div className="w-full max-w-md lg:max-w-xl">
      <p className="text-xl lg:text-2xl font-medium text-zinc-400 mb-4">
        {isSprint ? sprintQuestion : question}
      </p>
      <p className="text-3xl lg:text-4xl font-medium text-zinc-100 leading-relaxed mb-12">
        I want to{' '}
        <BlankInput value={focusText} onChange={setFocusText} onKeyDown={handleFocusKeyDown} placeholder="write the intro" inputRef={focusInputRef} className="max-w-[90%]" />
        .<br />
        {isSprint ? (
          <>I'll focus for{' '}</>
        ) : (
          <>It's 80% likely I'll be done<br />in{' '}</>
        )}
        <BlankInput value={timeInput} onChange={setTimeInput} onKeyDown={handleTimeKeyDown} placeholder="25m" inputRef={timeInputRef} />
        .
      </p>

      {isAiAb && (
        <div className="mb-4 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700 text-center">
          <span className="text-zinc-400 text-sm">🎲 After starting: </span>
          <span className="text-amber-400 font-medium">AI allowed</span>
          <span className="text-zinc-500"> or </span>
          <span className="text-rose-400 font-medium">forbidden</span>
        </div>
      )}

      <Text className="text-sm h-5 text-center">
        {parsedSeconds !== null && parsedSeconds > 0 && (
          <>
            <span>Parsed as {formatTimePreview(parsedSeconds)}</span>
            <span className="px-2">·</span>
            <span>Done at {getCompletionTime(parsedSeconds)}</span>
          </>
        )}
        {timeInput && parsedSeconds === null && (
          <span className="text-red-400">Invalid duration format</span>
        )}
      </Text>
      <div className="pt-4">
        <Button color="amber" className="w-full py-3 text-lg" disabled={!isValid} onClick={handleStart}>
          {isSprint ? 'Start Sprint' : isAiAb ? 'Start (coin flip)' : 'Start Focus'}
        </Button>
        <Text className="text-center text-xs mt-2 text-zinc-400">
          Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">Enter</kbd> to start
        </Text>

        {/* Pill buttons */}
        <div className="flex justify-center gap-3 mt-4">
          <button
            onClick={() => setMode(mode === 'sprint' ? 'predict' : 'sprint')}
            className={clsx(
              "text-xs px-3 py-1.5 rounded-full border transition-colors",
              isSprint
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                : "border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
            )}
          >
            🎯 Sprint mode
          </button>
          <button
            onClick={() => setMode(mode === 'ai-ab' ? 'predict' : 'ai-ab')}
            className={clsx(
              "text-xs px-3 py-1.5 rounded-full border transition-colors",
              isAiAb
                ? "border-purple-500/50 bg-purple-500/10 text-purple-400"
                : "border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
            )}
          >
            🎲 AI A/B test
          </button>
        </div>
      </div>
    </div>
  );
}

// Design A2: Text links (minimal)
function DesignTextLinks(props: DesignProps) {
  const { focusText, setFocusText, timeInput, setTimeInput, question, parsedSeconds, isValid, handleStart, focusInputRef, timeInputRef, handleFocusKeyDown, handleTimeKeyDown, mode, setMode, sprintQuestion } = props;

  const isSprint = mode === 'sprint';
  const isAiAb = mode === 'ai-ab';

  return (
    <div className="w-full max-w-md lg:max-w-xl">
      <p className="text-xl lg:text-2xl font-medium text-zinc-400 mb-4">
        {isSprint ? sprintQuestion : question}
      </p>
      <p className="text-3xl lg:text-4xl font-medium text-zinc-100 leading-relaxed mb-12">
        I want to{' '}
        <BlankInput value={focusText} onChange={setFocusText} onKeyDown={handleFocusKeyDown} placeholder="write the intro" inputRef={focusInputRef} className="max-w-[90%]" />
        .<br />
        {isSprint ? (
          <>I'll focus for{' '}</>
        ) : (
          <>It's 80% likely I'll be done<br />in{' '}</>
        )}
        <BlankInput value={timeInput} onChange={setTimeInput} onKeyDown={handleTimeKeyDown} placeholder="25m" inputRef={timeInputRef} />
        .
      </p>

      {isAiAb && (
        <div className="mb-4 text-center text-sm text-zinc-500">
          🎲 You'll be assigned <span className="text-amber-400">AI allowed</span> or <span className="text-rose-400">forbidden</span>
        </div>
      )}

      <Text className="text-sm h-5 text-center">
        {parsedSeconds !== null && parsedSeconds > 0 && (
          <>
            <span>Parsed as {formatTimePreview(parsedSeconds)}</span>
            <span className="px-2">·</span>
            <span>Done at {getCompletionTime(parsedSeconds)}</span>
          </>
        )}
        {timeInput && parsedSeconds === null && (
          <span className="text-red-400">Invalid duration format</span>
        )}
      </Text>
      <div className="pt-4">
        <Button color="amber" className="w-full py-3 text-lg" disabled={!isValid} onClick={handleStart}>
          {isSprint ? 'Start Sprint' : isAiAb ? 'Start' : 'Start Focus'}
        </Button>
        <Text className="text-center text-xs mt-2 text-zinc-400">
          Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">Enter</kbd> to start
        </Text>

        {/* Text links */}
        <div className="flex justify-center gap-4 mt-4 text-xs">
          <button
            onClick={() => setMode(mode === 'sprint' ? 'predict' : 'sprint')}
            className={clsx(
              "transition-colors underline-offset-2",
              isSprint
                ? "text-emerald-400 underline"
                : "text-zinc-600 hover:text-zinc-400 hover:underline"
            )}
          >
            {isSprint ? '✓ Sprint mode' : 'Sprint mode'}
          </button>
          <span className="text-zinc-700">·</span>
          <button
            onClick={() => setMode(mode === 'ai-ab' ? 'predict' : 'ai-ab')}
            className={clsx(
              "transition-colors underline-offset-2",
              isAiAb
                ? "text-purple-400 underline"
                : "text-zinc-600 hover:text-zinc-400 hover:underline"
            )}
          >
            {isAiAb ? '✓ AI experiment' : 'AI experiment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Design A3: Segmented control
function DesignSegmented(props: DesignProps) {
  const { focusText, setFocusText, timeInput, setTimeInput, question, parsedSeconds, isValid, handleStart, focusInputRef, timeInputRef, handleFocusKeyDown, handleTimeKeyDown, mode, setMode, sprintQuestion } = props;

  const isSprint = mode === 'sprint';
  const isAiAb = mode === 'ai-ab';

  return (
    <div className="w-full max-w-md lg:max-w-xl">
      <p className="text-xl lg:text-2xl font-medium text-zinc-400 mb-4">
        {isSprint ? sprintQuestion : question}
      </p>
      <p className="text-3xl lg:text-4xl font-medium text-zinc-100 leading-relaxed mb-12">
        I want to{' '}
        <BlankInput value={focusText} onChange={setFocusText} onKeyDown={handleFocusKeyDown} placeholder="write the intro" inputRef={focusInputRef} className="max-w-[90%]" />
        .<br />
        {isSprint ? (
          <>I'll focus for{' '}</>
        ) : (
          <>It's 80% likely I'll be done<br />in{' '}</>
        )}
        <BlankInput value={timeInput} onChange={setTimeInput} onKeyDown={handleTimeKeyDown} placeholder="25m" inputRef={timeInputRef} />
        .
      </p>

      {isAiAb && (
        <div className="mb-4 text-center text-sm text-zinc-500">
          🎲 Random assignment after start
        </div>
      )}

      <Text className="text-sm h-5 text-center">
        {parsedSeconds !== null && parsedSeconds > 0 && (
          <>
            <span>Parsed as {formatTimePreview(parsedSeconds)}</span>
            <span className="px-2">·</span>
            <span>Done at {getCompletionTime(parsedSeconds)}</span>
          </>
        )}
        {timeInput && parsedSeconds === null && (
          <span className="text-red-400">Invalid duration format</span>
        )}
      </Text>
      <div className="pt-4">
        <Button color="amber" className="w-full py-3 text-lg" disabled={!isValid} onClick={handleStart}>
          Start
        </Button>
        <Text className="text-center text-xs mt-2 text-zinc-400">
          Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">Enter</kbd> to start
        </Text>

        {/* Segmented control */}
        <div className="flex justify-center mt-4">
          <div className="inline-flex rounded-md bg-zinc-800/50 p-0.5 text-xs">
            <button
              onClick={() => setMode('predict')}
              className={clsx(
                "px-3 py-1 rounded transition-colors",
                mode === 'predict' ? "bg-zinc-700 text-zinc-200" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              Predict
            </button>
            <button
              onClick={() => setMode('sprint')}
              className={clsx(
                "px-3 py-1 rounded transition-colors",
                mode === 'sprint' ? "bg-zinc-700 text-zinc-200" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              Sprint
            </button>
            <button
              onClick={() => setMode('ai-ab')}
              className={clsx(
                "px-3 py-1 rounded transition-colors",
                mode === 'ai-ab' ? "bg-purple-600/80 text-zinc-200" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              🎲 AI
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Design A4: Icon toggles (very minimal)
function DesignIconToggles(props: DesignProps) {
  const { focusText, setFocusText, timeInput, setTimeInput, question, parsedSeconds, isValid, handleStart, focusInputRef, timeInputRef, handleFocusKeyDown, handleTimeKeyDown, mode, setMode, sprintQuestion } = props;

  const isSprint = mode === 'sprint';
  const isAiAb = mode === 'ai-ab';

  return (
    <div className="w-full max-w-md lg:max-w-xl">
      <p className="text-xl lg:text-2xl font-medium text-zinc-400 mb-4">
        {isSprint ? sprintQuestion : question}
      </p>
      <p className="text-3xl lg:text-4xl font-medium text-zinc-100 leading-relaxed mb-12">
        I want to{' '}
        <BlankInput value={focusText} onChange={setFocusText} onKeyDown={handleFocusKeyDown} placeholder="write the intro" inputRef={focusInputRef} className="max-w-[90%]" />
        .<br />
        {isSprint ? (
          <>I'll focus for{' '}</>
        ) : (
          <>It's 80% likely I'll be done<br />in{' '}</>
        )}
        <BlankInput value={timeInput} onChange={setTimeInput} onKeyDown={handleTimeKeyDown} placeholder="25m" inputRef={timeInputRef} />
        .
      </p>

      {isAiAb && (
        <div className="mb-4 text-center text-xs text-zinc-600">
          AI will be randomly allowed or forbidden
        </div>
      )}

      <Text className="text-sm h-5 text-center">
        {parsedSeconds !== null && parsedSeconds > 0 && (
          <>
            <span>Parsed as {formatTimePreview(parsedSeconds)}</span>
            <span className="px-2">·</span>
            <span>Done at {getCompletionTime(parsedSeconds)}</span>
          </>
        )}
        {timeInput && parsedSeconds === null && (
          <span className="text-red-400">Invalid duration format</span>
        )}
      </Text>
      <div className="pt-4">
        <Button color="amber" className="w-full py-3 text-lg" disabled={!isValid} onClick={handleStart}>
          {isSprint ? 'Start Sprint' : 'Start Focus'}
        </Button>
        <Text className="text-center text-xs mt-2 text-zinc-400">
          Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">Enter</kbd> to start
        </Text>

        {/* Icon toggles */}
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => setMode(mode === 'sprint' ? 'predict' : 'sprint')}
            title="Sprint mode (no prediction tracking)"
            className={clsx(
              "w-8 h-8 rounded-full flex items-center justify-center transition-all text-sm",
              isSprint
                ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50"
                : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800"
            )}
          >
            🎯
          </button>
          <button
            onClick={() => setMode(mode === 'ai-ab' ? 'predict' : 'ai-ab')}
            title="AI A/B experiment"
            className={clsx(
              "w-8 h-8 rounded-full flex items-center justify-center transition-all text-sm",
              isAiAb
                ? "bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/50"
                : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800"
            )}
          >
            🎲
          </button>
        </div>
      </div>
    </div>
  );
}

// Design C0: Icon tabs at top
function DesignIconTabs(props: DesignProps) {
  const { focusText, setFocusText, timeInput, setTimeInput, question, parsedSeconds, isValid, handleStart, focusInputRef, timeInputRef, handleFocusKeyDown, handleTimeKeyDown, mode, setMode, sprintQuestion } = props;

  const isSprint = mode === 'sprint';
  const isAiAb = mode === 'ai-ab';

  return (
    <div className="w-full max-w-md lg:max-w-xl">
      {/* Icon tabs at top */}
      <div className="flex gap-2 mb-8">
        <button
          onClick={() => setMode('predict')}
          title="Prediction mode"
          className={clsx(
            "w-8 h-8 rounded-full flex items-center justify-center transition-all text-sm",
            mode === 'predict'
              ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50"
              : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800"
          )}
        >
          ⏱️
        </button>
        <button
          onClick={() => setMode('sprint')}
          title="Sprint mode (no prediction)"
          className={clsx(
            "w-8 h-8 rounded-full flex items-center justify-center transition-all text-sm",
            mode === 'sprint'
              ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50"
              : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800"
          )}
        >
          🎯
        </button>
        <button
          onClick={() => setMode('ai-ab')}
          title="AI A/B experiment"
          className={clsx(
            "w-8 h-8 rounded-full flex items-center justify-center transition-all text-sm",
            mode === 'ai-ab'
              ? "bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/50"
              : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800"
          )}
        >
          🎲
        </button>
      </div>

      <p className="text-xl lg:text-2xl font-medium text-zinc-400 mb-4">
        {isSprint ? sprintQuestion : question}
      </p>
      <p className="text-3xl lg:text-4xl font-medium text-zinc-100 leading-relaxed mb-12">
        I want to{' '}
        <BlankInput value={focusText} onChange={setFocusText} onKeyDown={handleFocusKeyDown} placeholder="write the intro" inputRef={focusInputRef} className="max-w-[90%]" />
        .<br />
        {isSprint ? (
          <>I'll focus for{' '}</>
        ) : (
          <>It's 80% likely I'll be done<br />in{' '}</>
        )}
        <BlankInput value={timeInput} onChange={setTimeInput} onKeyDown={handleTimeKeyDown} placeholder="25m" inputRef={timeInputRef} />
        .
      </p>

      {isAiAb && (
        <div className="mb-4 text-center text-xs text-zinc-600">
          AI will be randomly allowed or forbidden
        </div>
      )}

      <Text className="text-sm h-5 text-center">
        {parsedSeconds !== null && parsedSeconds > 0 && (
          <>
            <span>Parsed as {formatTimePreview(parsedSeconds)}</span>
            <span className="px-2">·</span>
            <span>Done at {getCompletionTime(parsedSeconds)}</span>
          </>
        )}
        {timeInput && parsedSeconds === null && (
          <span className="text-red-400">Invalid duration format</span>
        )}
      </Text>
      <div className="pt-4">
        <Button color="amber" className="w-full py-3 text-lg" disabled={!isValid} onClick={handleStart}>
          {isSprint ? 'Start Sprint' : 'Start Focus'}
        </Button>
        <Text className="text-center text-xs mt-2 text-zinc-400">
          Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">Enter</kbd> to start
        </Text>
      </div>
    </div>
  );
}

// Design C1: Discreet tabs at top (subtle text links)
function DesignDiscreetTabs(props: DesignProps) {
  const { focusText, setFocusText, timeInput, setTimeInput, question, parsedSeconds, isValid, handleStart, focusInputRef, timeInputRef, handleFocusKeyDown, handleTimeKeyDown, mode, setMode, sprintQuestion } = props;

  const isSprint = mode === 'sprint';
  const isAiAb = mode === 'ai-ab';

  return (
    <div className="w-full max-w-md lg:max-w-xl">
      {/* Discreet tabs - very subtle */}
      <div className="flex gap-4 mb-8 text-xs">
        <button
          onClick={() => setMode('predict')}
          className={clsx(
            "transition-colors",
            mode === 'predict' ? "text-zinc-400" : "text-zinc-700 hover:text-zinc-500"
          )}
        >
          Prediction
        </button>
        <button
          onClick={() => setMode('sprint')}
          className={clsx(
            "transition-colors",
            mode === 'sprint' ? "text-zinc-400" : "text-zinc-700 hover:text-zinc-500"
          )}
        >
          Sprint
        </button>
        <button
          onClick={() => setMode('ai-ab')}
          className={clsx(
            "transition-colors",
            mode === 'ai-ab' ? "text-purple-400/80" : "text-zinc-700 hover:text-zinc-500"
          )}
        >
          🎲 AI test
        </button>
      </div>

      <p className="text-xl lg:text-2xl font-medium text-zinc-400 mb-4">
        {isSprint ? sprintQuestion : question}
      </p>
      <p className="text-3xl lg:text-4xl font-medium text-zinc-100 leading-relaxed mb-12">
        I want to{' '}
        <BlankInput value={focusText} onChange={setFocusText} onKeyDown={handleFocusKeyDown} placeholder="write the intro" inputRef={focusInputRef} className="max-w-[90%]" />
        .<br />
        {isSprint ? (
          <>I'll focus for{' '}</>
        ) : (
          <>It's 80% likely I'll be done<br />in{' '}</>
        )}
        <BlankInput value={timeInput} onChange={setTimeInput} onKeyDown={handleTimeKeyDown} placeholder="25m" inputRef={timeInputRef} />
        .
      </p>

      {isAiAb && (
        <div className="mb-4 text-center text-xs text-zinc-600">
          You'll be randomly assigned: AI allowed or forbidden
        </div>
      )}

      <Text className="text-sm h-5 text-center">
        {parsedSeconds !== null && parsedSeconds > 0 && (
          <>
            <span>Parsed as {formatTimePreview(parsedSeconds)}</span>
            <span className="px-2">·</span>
            <span>Done at {getCompletionTime(parsedSeconds)}</span>
          </>
        )}
        {timeInput && parsedSeconds === null && (
          <span className="text-red-400">Invalid duration format</span>
        )}
      </Text>
      <div className="pt-4">
        <Button color="amber" className="w-full py-3 text-lg" disabled={!isValid} onClick={handleStart}>
          {isSprint ? 'Start Sprint' : 'Start Focus'}
        </Button>
        <Text className="text-center text-xs mt-2 text-zinc-400">
          Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">Enter</kbd> to start
        </Text>
      </div>
    </div>
  );
}

// Design C2: Underline tabs at top
function DesignUnderlineTabs(props: DesignProps) {
  const { focusText, setFocusText, timeInput, setTimeInput, question, parsedSeconds, isValid, handleStart, focusInputRef, timeInputRef, handleFocusKeyDown, handleTimeKeyDown, mode, setMode, sprintQuestion } = props;

  const isSprint = mode === 'sprint';
  const isAiAb = mode === 'ai-ab';

  return (
    <div className="w-full max-w-md lg:max-w-xl">
      {/* Underline tabs */}
      <div className="flex gap-6 mb-8 text-sm border-b border-zinc-800 pb-2">
        <button
          onClick={() => setMode('predict')}
          className={clsx(
            "transition-colors pb-2 -mb-2",
            mode === 'predict'
              ? "text-zinc-300 border-b-2 border-amber-500/50"
              : "text-zinc-600 hover:text-zinc-400"
          )}
        >
          Prediction
        </button>
        <button
          onClick={() => setMode('sprint')}
          className={clsx(
            "transition-colors pb-2 -mb-2",
            mode === 'sprint'
              ? "text-zinc-300 border-b-2 border-emerald-500/50"
              : "text-zinc-600 hover:text-zinc-400"
          )}
        >
          Sprint
        </button>
        <button
          onClick={() => setMode('ai-ab')}
          className={clsx(
            "transition-colors pb-2 -mb-2",
            mode === 'ai-ab'
              ? "text-zinc-300 border-b-2 border-purple-500/50"
              : "text-zinc-600 hover:text-zinc-400"
          )}
        >
          🎲 AI test
        </button>
      </div>

      <p className="text-xl lg:text-2xl font-medium text-zinc-400 mb-4">
        {isSprint ? sprintQuestion : question}
      </p>
      <p className="text-3xl lg:text-4xl font-medium text-zinc-100 leading-relaxed mb-12">
        I want to{' '}
        <BlankInput value={focusText} onChange={setFocusText} onKeyDown={handleFocusKeyDown} placeholder="write the intro" inputRef={focusInputRef} className="max-w-[90%]" />
        .<br />
        {isSprint ? (
          <>I'll focus for{' '}</>
        ) : (
          <>It's 80% likely I'll be done<br />in{' '}</>
        )}
        <BlankInput value={timeInput} onChange={setTimeInput} onKeyDown={handleTimeKeyDown} placeholder="25m" inputRef={timeInputRef} />
        .
      </p>

      {isAiAb && (
        <div className="mb-4 text-center text-xs text-zinc-600">
          Random assignment after start
        </div>
      )}

      <Text className="text-sm h-5 text-center">
        {parsedSeconds !== null && parsedSeconds > 0 && (
          <>
            <span>Parsed as {formatTimePreview(parsedSeconds)}</span>
            <span className="px-2">·</span>
            <span>Done at {getCompletionTime(parsedSeconds)}</span>
          </>
        )}
        {timeInput && parsedSeconds === null && (
          <span className="text-red-400">Invalid duration format</span>
        )}
      </Text>
      <div className="pt-4">
        <Button color="amber" className="w-full py-3 text-lg" disabled={!isValid} onClick={handleStart}>
          {isSprint ? 'Start Sprint' : 'Start Focus'}
        </Button>
        <Text className="text-center text-xs mt-2 text-zinc-400">
          Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">Enter</kbd> to start
        </Text>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component with Design Switcher
// ============================================================================

export function NewFocus() {
  const { startTimer, showConfetti, clearConfetti, lastUsedDuration } = useApp()
  const [focusText, setFocusText] = useState('')
  const [timeInput, setTimeInput] = useState('')
  const [question, setQuestion] = useState(QUESTIONS[0])
  const [sprintQuestion, setSprintQuestion] = useState(SPRINT_QUESTIONS[0])
  const focusInputRef = useRef<HTMLInputElement>(null)
  const timeInputRef = useRef<HTMLInputElement>(null)

  // Design comparison state
  const [designVariant, setDesignVariant] = useState<DesignVariant>('original')
  const [mode, setMode] = useState<SessionMode>('predict')
  const [aiEnabled, setAiEnabled] = useState(false)

  const parsedSeconds = parseTime(timeInput)
  const isValid = focusText.trim() && parsedSeconds !== null && parsedSeconds > 0

  // Pick random questions on mount
  useEffect(() => {
    setQuestion(QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]);
    setSprintQuestion(SPRINT_QUESTIONS[Math.floor(Math.random() * SPRINT_QUESTIONS.length)]);
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

    await startTimer(focusText.trim(), parsedSeconds)
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

  const designProps: DesignProps = {
    focusText, setFocusText, timeInput, setTimeInput, question, parsedSeconds, isValid, handleStart,
    focusInputRef, timeInputRef, handleFocusKeyDown, handleTimeKeyDown,
    mode, setMode, aiEnabled, setAiEnabled, sprintQuestion,
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8 relative">
      {/* Design Switcher - DEV ONLY */}
      <div className="fixed top-16 right-4 z-50 bg-zinc-900 border border-zinc-700 rounded-lg p-2 shadow-xl max-h-[80vh] overflow-y-auto">
        <div className="text-xs text-zinc-500 mb-2 font-medium">Design Variant</div>
        <div className="flex flex-col gap-1">
          <div className="text-[10px] text-zinc-600 mt-1 mb-0.5">— Baseline —</div>
          <button
            onClick={() => { setDesignVariant('original'); setMode('predict'); }}
            className={clsx("text-xs px-2 py-1 rounded text-left transition-colors", designVariant === 'original' ? "bg-amber-500/20 text-amber-400" : "text-zinc-400 hover:bg-zinc-800")}
          >
            0. Original
          </button>

          <div className="text-[10px] text-zinc-600 mt-2 mb-0.5">— Buttons below —</div>
          <button
            onClick={() => { setDesignVariant('pills'); setMode('predict'); }}
            className={clsx("text-xs px-2 py-1 rounded text-left transition-colors", designVariant === 'pills' ? "bg-amber-500/20 text-amber-400" : "text-zinc-400 hover:bg-zinc-800")}
          >
            A1. Pill buttons
          </button>
          <button
            onClick={() => { setDesignVariant('text-links'); setMode('predict'); }}
            className={clsx("text-xs px-2 py-1 rounded text-left transition-colors", designVariant === 'text-links' ? "bg-amber-500/20 text-amber-400" : "text-zinc-400 hover:bg-zinc-800")}
          >
            A2. Text links
          </button>
          <button
            onClick={() => { setDesignVariant('segmented'); setMode('predict'); }}
            className={clsx("text-xs px-2 py-1 rounded text-left transition-colors", designVariant === 'segmented' ? "bg-amber-500/20 text-amber-400" : "text-zinc-400 hover:bg-zinc-800")}
          >
            A3. Segmented control
          </button>
          <button
            onClick={() => { setDesignVariant('icons'); setMode('predict'); }}
            className={clsx("text-xs px-2 py-1 rounded text-left transition-colors", designVariant === 'icons' ? "bg-amber-500/20 text-amber-400" : "text-zinc-400 hover:bg-zinc-800")}
          >
            A4. Icon toggles
          </button>

          <div className="text-[10px] text-zinc-600 mt-2 mb-0.5">— Tabs at top —</div>
          <button
            onClick={() => { setDesignVariant('icon-tabs'); setMode('predict'); }}
            className={clsx("text-xs px-2 py-1 rounded text-left transition-colors", designVariant === 'icon-tabs' ? "bg-amber-500/20 text-amber-400" : "text-zinc-400 hover:bg-zinc-800")}
          >
            C0. Icon tabs ⭐
          </button>
          <button
            onClick={() => { setDesignVariant('discreet-tabs'); setMode('predict'); }}
            className={clsx("text-xs px-2 py-1 rounded text-left transition-colors", designVariant === 'discreet-tabs' ? "bg-amber-500/20 text-amber-400" : "text-zinc-400 hover:bg-zinc-800")}
          >
            C1. Discreet text tabs
          </button>
          <button
            onClick={() => { setDesignVariant('underline-tabs'); setMode('predict'); }}
            className={clsx("text-xs px-2 py-1 rounded text-left transition-colors", designVariant === 'underline-tabs' ? "bg-amber-500/20 text-amber-400" : "text-zinc-400 hover:bg-zinc-800")}
          >
            C2. Underline tabs
          </button>
        </div>
      </div>

      {/* Render selected design */}
      {designVariant === 'original' && <DesignOriginal {...designProps} />}
      {designVariant === 'pills' && <DesignButtonsBelow {...designProps} />}
      {designVariant === 'text-links' && <DesignTextLinks {...designProps} />}
      {designVariant === 'segmented' && <DesignSegmented {...designProps} />}
      {designVariant === 'icons' && <DesignIconToggles {...designProps} />}
      {designVariant === 'icon-tabs' && <DesignIconTabs {...designProps} />}
      {designVariant === 'discreet-tabs' && <DesignDiscreetTabs {...designProps} />}
      {designVariant === 'underline-tabs' && <DesignUnderlineTabs {...designProps} />}
    </div>
  )
}
