import { useEffect, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { CountdownDisplay } from '../src/components/CountdownDisplay'
import { Kbd } from '../src/components/Kbd'
import { parseCommand } from '../src/lib/command-parser'
import { formatDuration } from '../src/lib/format'
import { formatErrorPercent, getCompletionRemark } from '../src/lib/completion-remarks'

/**
 * A working copy of the timer for the landing page. It is already running when the page
 * opens, timing the visit itself, and docks to the corner of the window once scrolled
 * past, the way the desktop app sits in a corner of the screen.
 *
 * It uses the app's parser, countdown display and completion remarks, but keeps its own
 * small state rather than the app's timer machine: nothing here is saved, and it must
 * never touch the sessions of the real app served from /app/ on the same origin.
 */

const FIRST_TASK = { intent: 'discover Pucoti', seconds: 5 * 60 }
const TICK_MS = 200
const EXAMPLES = ['reply to emails 10m', 'write the intro 25m', 'fix the login bug 45m']

interface Running {
  intent: string
  predicted: number
  /** j/k nudges. Moves the countdown, never the prediction that gets scored. */
  adjustment: number
  startedAt: number
}

interface Run {
  intent: string
  predicted: number
  actual: number
  remark: ReactNode
}

type View =
  | { kind: 'edit' }
  | { kind: 'running'; timer: Running }
  | { kind: 'done'; run: Run }

function startTimer(intent: string, predicted: number): View {
  return { kind: 'running', timer: { intent, predicted, adjustment: 0, startedAt: Date.now() } }
}

export function TimerDemo() {
  const [view, setView] = useState<View>(() => startTimer(FIRST_TASK.intent, FIRST_TASK.seconds))
  const [input, setInput] = useState('')
  const [noPrediction, setNoPrediction] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [docked, setDocked] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  const running = view.kind === 'running' ? view.timer : null
  const elapsed = running ? Math.max(0, Math.floor((now - running.startedAt) / 1000)) : 0
  const remaining = running ? running.predicted + running.adjustment - elapsed : 0

  // The clock. Like the app, time is derived from the start, never accumulated.
  const isRunning = running !== null
  useEffect(() => {
    if (!isRunning) return
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS)
    return () => window.clearInterval(id)
  }, [isRunning])

  // One ring when the countdown crosses zero, like the app's first bell. Browsers drop it
  // if the visitor has not interacted with the page yet, which is the polite outcome.
  const rangRef = useRef(false)
  useEffect(() => {
    if (!running) {
      rangRef.current = false
      return
    }
    if (remaining < 0 && !rangRef.current) {
      rangRef.current = true
      new Audio(import.meta.env.BASE_URL + 'bell.mp3').play().catch(() => {})
    }
  }, [running, remaining])

  // Dock once most of the demo has scrolled up out of view. Only upwards: on a phone the
  // demo starts below the fold, and a corner copy of something just below would be noise.
  // A scroll listener rather than an IntersectionObserver, which never fires when the page
  // jumps from below the demo to above it (a reload halfway down, an anchor link).
  // Browsers already fire scroll at most once per frame, so there is nothing to throttle.
  useEffect(() => {
    const update = () => {
      const rect = frameRef.current?.getBoundingClientRect()
      if (rect) setDocked(rect.bottom < rect.height * 0.25)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  // Move focus with the view so the keys keep working, but not on load: the page should
  // not open with focus parked in the middle of it.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (view.kind === 'edit' && window.matchMedia('(pointer: fine)').matches) {
      inputRef.current?.focus({ preventScroll: true })
    } else if (view.kind !== 'edit') {
      frameRef.current?.focus({ preventScroll: true })
    }
  }, [view.kind])

  const parsed = parseCommand(input)

  function start() {
    if (parsed.seconds === null) {
      setNoPrediction(true)
      return
    }
    setNoPrediction(false)
    setNow(Date.now())
    setView(startTimer(parsed.intent, parsed.seconds))
  }

  function finish() {
    if (!running) return
    setView({
      kind: 'done',
      run: {
        intent: running.intent,
        predicted: running.predicted,
        actual: elapsed,
        remark: getCompletionRemark(errorPercent(running.predicted, elapsed)),
      },
    })
  }

  function backToEdit() {
    setInput('')
    setView({ kind: 'edit' })
  }

  function adjust(delta: number) {
    setView(v => v.kind === 'running'
      ? { kind: 'running', timer: { ...v.timer, adjustment: v.timer.adjustment + delta } }
      : v)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (view.kind === 'running') {
      const actions: Record<string, () => void> = {
        Enter: finish,
        q: backToEdit,
        j: () => adjust(-60),
        k: () => adjust(60),
        J: () => adjust(-300),
        K: () => adjust(300),
      }
      const action = actions[e.key]
      if (action) {
        e.preventDefault()
        action()
      }
    } else if (view.kind === 'done' && e.key === 'Enter') {
      e.preventDefault()
      backToEdit()
    }
  }

  return (
    <>
      <div
        ref={frameRef}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="rounded-2xl border border-zinc-800 bg-surface shadow-2xl shadow-black/60 outline-none overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 h-11 border-b border-zinc-800/80 bg-surface-raised text-base text-zinc-400">
          <img src={import.meta.env.BASE_URL + 'icon-128.png'} alt="" className="size-5" />
          Pucoti
        </div>

        <div className="flex flex-col items-center justify-center text-center px-4 sm:px-8 py-8 min-h-[30rem]">
          {view.kind === 'edit' && (
            <>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => {
                  setInput(e.target.value)
                  setNoPrediction(false)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    start()
                  }
                }}
                placeholder="I want to… 12m"
                aria-label="What you will do, and how long you think it will take"
                className={clsx(
                  'w-full text-3xl sm:text-4xl text-center font-medium pb-2',
                  'bg-transparent outline-none border-b-4 transition-colors',
                  'text-accent placeholder-zinc-600',
                  noPrediction
                    ? 'border-red-500/50 focus:border-red-500'
                    : 'border-accent/50 focus:border-accent',
                )}
                autoComplete="off"
                spellCheck={false}
              />
              <CountdownDisplay
                remaining={parsed.seconds ?? 0}
                autoscale
                accentColor="amber"
                className={clsx('h-32! sm:h-40! mt-4', parsed.seconds === null && 'opacity-30')}
              />
              {noPrediction ? (
                <p className="text-red-400">Add a prediction, like <Kbd>15m</Kbd></p>
              ) : parsed.seconds !== null ? (
                <p className="text-zinc-300">
                  It's 80% likely I'll be done in{' '}
                  <span className="text-accent font-medium">{formatDuration(parsed.seconds)}</span>
                </p>
              ) : (
                <p className="text-zinc-500">A task and a guess. Then Enter.</p>
              )}
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {EXAMPLES.map(example => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => {
                      setInput(example)
                      setNoPrediction(false)
                      inputRef.current?.focus()
                    }}
                    className="text-base px-3 py-1.5 rounded-full border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-600 transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
              <div className="mt-6">
                <ActionButton keys={['Enter']} label="Start" onClick={start} primary />
              </div>
            </>
          )}

          {view.kind === 'running' && running && (
            <>
              <p className="text-3xl sm:text-4xl font-medium text-accent max-w-full truncate min-h-[1.25em]">
                {running.intent}
              </p>
              <CountdownDisplay
                remaining={remaining}
                autoscale
                accentColor="amber"
                className="h-32! sm:h-40! mt-4"
              />
              <p className="text-zinc-300 font-mono">
                {formatDuration(elapsed)} / {formatDuration(running.predicted)} predicted
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-8">
                <ActionButton keys={['Enter']} label="Done" onClick={finish} primary />
                <ActionButton keys={['k']} label="+1 min" onClick={() => adjust(60)} />
                <ActionButton keys={['q']} label="New task" onClick={backToEdit} />
              </div>
            </>
          )}

          {view.kind === 'done' && <DoneView run={view.run} onNext={backToEdit} />}
        </div>
      </div>

      {/* The same timer, docked to the corner while the demo is scrolled away */}
      {running && (
        <button
          type="button"
          onClick={() => frameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          aria-hidden={!docked}
          tabIndex={docked ? 0 : -1}
          title="Back to the timer"
          className={clsx(
            // Square, with the accent border: it stands for the app's own corner window
            'fixed bottom-4 right-4 z-20 w-56 border-2 border-accent bg-surface',
            'px-4 pt-3 pb-2 shadow-2xl shadow-black/60 text-center',
            'transition duration-300 motion-reduce:transition-none',
            docked ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none',
          )}
        >
          <p className="text-lg font-medium text-accent truncate">{running.intent || 'Untitled'}</p>
          <CountdownDisplay remaining={remaining} accentColor="amber" className="h-14 text-5xl" />
        </button>
      )}
    </>
  )
}

function DoneView({ run, onNext }: { run: Run; onNext: () => void }) {
  const error = errorPercent(run.predicted, run.actual)
  const close = Math.abs(error) <= 10

  return (
    <>
      {run.intent && <p className="text-xl text-accent font-medium max-w-full truncate">{run.intent}</p>}
      <p className="text-zinc-400 mt-1">
        Predicted {formatDuration(run.predicted)}, took {formatDuration(run.actual)}
      </p>
      <p className={clsx('text-3xl sm:text-4xl font-semibold mt-4', close ? 'text-success' : 'text-zinc-100')}>
        {formatErrorPercent(error)}
      </p>
      <p className="text-zinc-400 mt-2 max-w-md">{run.remark}</p>
      <p className="text-zinc-400 mt-8 max-w-md">
        The app keeps every one of these, and after a few dozen tells you how much to add to
        your estimates.
      </p>
      <div className="flex flex-wrap justify-center gap-2 mt-6">
        <a
          href="/app/"
          className="flex items-center text-base px-3 py-2 rounded-lg bg-accent text-black font-medium hover:bg-accent-hover"
        >
          Open the app
        </a>
        <ActionButton keys={['Enter']} label="Try another" onClick={onNext} />
      </div>
    </>
  )
}

function ActionButton({ keys, label, onClick, primary }: {
  keys: string[]
  label: string
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex items-center gap-2 text-base px-3 py-2 rounded-lg border transition-colors',
        primary
          ? 'border-accent/60 text-zinc-100 hover:bg-accent/10'
          : 'border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-600',
      )}
    >
      <span className="hidden sm:flex gap-1">
        {keys.map(k => <Kbd key={k}>{k}</Kbd>)}
      </span>
      {label}
    </button>
  )
}

/** Positive when it took longer than predicted, as on the app's completion screen. */
function errorPercent(predicted: number, actual: number): number {
  return ((actual - predicted) / predicted) * 100
}
