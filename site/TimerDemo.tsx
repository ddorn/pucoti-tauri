import { useEffect, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { CountdownDisplay } from '../src/components/CountdownDisplay'
import { Kbd } from '../src/components/Kbd'
import { parseCommand } from '../src/lib/command-parser'
import { formatDuration } from '../src/lib/format'
import { computeAdjustmentCurve } from '../src/lib/stats'
import { formatErrorPercent, getCompletionRemark } from '../src/lib/completion-remarks'
import type { Session } from '../src/lib/session'

/**
 * A working copy of the timer for the landing page: predict, run, finish, see how far off
 * you were. It uses the app's parser, display and calibration maths, but keeps its own
 * small state rather than the app's timer machine, because it needs a fast-forward that
 * the real timer must never have. Nothing is stored: it is gone on reload, and it never
 * touches the sessions of the real app served from /app/ on the same origin.
 */

const FAST_FORWARD = 60
const TICK_MS = 200
/** Below this, the 80% adjustment is computed from too few points to mean anything. */
const RUNS_FOR_CALIBRATION = 3
const EXAMPLES = ['reply to emails 10m', 'write the intro 25m', 'fix the login bug 45m']

interface Running {
  intent: string
  predicted: number
  /** j/k nudges. Moves the countdown, never the prediction that gets scored. */
  adjustment: number
  elapsedMs: number
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

export function TimerDemo() {
  const [view, setView] = useState<View>({ kind: 'edit' })
  const [input, setInput] = useState('')
  const [fast, setFast] = useState(false)
  const [runs, setRuns] = useState<Run[]>([])
  const [noPrediction, setNoPrediction] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  // The clock reads the speed through a ref, so toggling it does not restart the interval
  const fastRef = useRef(fast)
  useEffect(() => {
    fastRef.current = fast
  }, [fast])

  const running = view.kind === 'running' ? view.timer : null
  const remaining = running
    ? running.predicted + running.adjustment - Math.floor(running.elapsedMs / 1000)
    : 0

  // The clock. Elapsed is accumulated rather than derived from a start time, so that
  // switching speed mid-run does not rewrite the time already spent.
  const isRunning = running !== null
  useEffect(() => {
    if (!isRunning) return
    let last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      const dt = (now - last) * (fastRef.current ? FAST_FORWARD : 1)
      last = now
      setView(v => v.kind === 'running'
        ? { kind: 'running', timer: { ...v.timer, elapsedMs: v.timer.elapsedMs + dt } }
        : v)
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [isRunning])

  // One ring when the countdown crosses zero, like the app's first bell
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

  // Focus the field on desktop only: on a phone it would pop the keyboard over the page
  useEffect(() => {
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
    setView({
      kind: 'running',
      timer: { intent: parsed.intent, predicted: parsed.seconds, adjustment: 0, elapsedMs: 0 },
    })
  }

  function finish() {
    if (!running) return
    const actual = Math.floor(running.elapsedMs / 1000)
    const run: Run = {
      intent: running.intent,
      predicted: running.predicted,
      actual,
      remark: getCompletionRemark(errorPercent(running.predicted, actual)),
    }
    setRuns(r => [...r, run])
    setView({ kind: 'done', run })
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
        f: () => setFast(f => !f),
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
    <div
      ref={frameRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="rounded-2xl border border-zinc-800 bg-surface shadow-2xl shadow-black/60 outline-none overflow-hidden"
    >
      {/* Title bar */}
      <div className="flex items-center justify-between gap-3 px-4 h-10 border-b border-zinc-800/80 bg-surface-raised">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <img src={import.meta.env.BASE_URL + 'icon-128.png'} alt="" className="size-4" />
          Pucoti <span className="text-zinc-600">· demo</span>
        </div>
        <button
          type="button"
          onClick={() => setFast(f => !f)}
          className={clsx(
            'text-xs font-mono px-2 py-1 rounded-md transition-colors',
            fast ? 'bg-accent text-black' : 'text-zinc-400 hover:bg-zinc-800',
          )}
          title="Fast-forward: one minute per second (f)"
          aria-pressed={fast}
        >
          {fast ? `${FAST_FORWARD}× speed` : '1× speed'}
        </button>
      </div>

      <div className="flex flex-col items-center justify-center text-center px-4 sm:px-8 py-8 min-h-[31rem]">
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
              <p className="text-red-400 text-lg">
                Add a prediction, like <Kbd>15m</Kbd>
              </p>
            ) : parsed.seconds !== null ? (
              <p className="text-lg text-zinc-300">
                It's 80% likely I'll be done in{' '}
                <span className="text-accent font-medium">{formatDuration(parsed.seconds)}</span>
              </p>
            ) : (
              <p className="text-lg text-zinc-500">A task and a guess. Then Enter.</p>
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
                  className="text-sm px-3 py-1.5 rounded-full border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-600 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
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
            <p className="text-lg text-zinc-300 font-mono">
              {formatDuration(Math.floor(running.elapsedMs / 1000))} / {formatDuration(running.predicted)} predicted
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-8">
              <ActionButton keys={['Enter']} label="Done" onClick={finish} primary />
              <ActionButton keys={['k']} label="+1 min" onClick={() => adjust(60)} />
              <ActionButton
                keys={['f']}
                label={fast ? 'Real time' : 'Fast-forward'}
                onClick={() => setFast(f => !f)}
              />
              <ActionButton keys={['q']} label="Bin it" onClick={backToEdit} />
            </div>
          </>
        )}

        {view.kind === 'done' && (
          <DoneView run={view.run} runs={runs} onNext={backToEdit} />
        )}
      </div>
    </div>
  )
}

function DoneView({ run, runs, onNext }: { run: Run; runs: Run[]; onNext: () => void }) {
  const error = errorPercent(run.predicted, run.actual)
  const close = Math.abs(error) <= 10

  const adjustment80 = runs.length >= RUNS_FOR_CALIBRATION
    ? computeAdjustmentCurve(runs.map(toSession))?.adjustment80 ?? null
    : null

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

      <div className="mt-6 w-full max-w-sm rounded-xl bg-surface-raised px-4 py-3 text-left">
        {adjustment80 !== null ? (
          <p className="text-zinc-300">
            To be on time 80% of the time,{' '}
            {adjustment80 >= 0 ? (
              <>add <span className="text-accent font-semibold">{Math.round(adjustment80)}%</span> to your estimates.</>
            ) : (
              <>you could cut <span className="text-accent font-semibold">{Math.round(-adjustment80)}%</span> from your estimates.</>
            )}
            <span className="block text-sm text-zinc-500 mt-1">
              From {runs.length} demo tasks. The app works this out from your real ones.
            </span>
          </p>
        ) : (
          <p className="text-zinc-400 text-sm">
            {RUNS_FOR_CALIBRATION - runs.length} more {RUNS_FOR_CALIBRATION - runs.length === 1 ? 'task' : 'tasks'} and
            this turns into your first calibration: how much to add to your estimates.
          </p>
        )}
      </div>

      <div className="mt-6">
        <ActionButton keys={['Enter']} label="Next task" onClick={onNext} primary />
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
        'flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-colors',
        primary
          ? 'border-accent/60 text-zinc-100 hover:bg-accent/10'
          : 'border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-600',
      )}
    >
      <span className="hidden sm:flex gap-1">
        {keys.map(k => <Kbd key={k} className="text-xs">{k}</Kbd>)}
      </span>
      {label}
    </button>
  )
}

/** Positive when it took longer than predicted, as on the app's completion screen. */
function errorPercent(predicted: number, actual: number): number {
  return ((actual - predicted) / predicted) * 100
}

function toSession(run: Run): Session {
  return {
    timestamp: new Date(),
    focusText: run.intent,
    predictedSeconds: run.predicted,
    actualSeconds: run.actual,
    status: 'completed',
    tags: ['mode:predict'],
  }
}
