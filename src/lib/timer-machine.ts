const TIMER_TICK_INTERVAL = 200 // milliseconds

const DEFAULT_COUNTDOWN_SECONDS = 300 // 5 minutes

/**
 * Where a timer came from, which decides whether it can be saved, held, or binned.
 *
 * - `user`     — started by the user. The only kind that is ever written to storage.
 * - `scratch`  — the idle placeholder that keeps a countdown on screen when the stack
 *                is otherwise empty. Replaced (not held) when a real timer starts.
 * - `transient`— the scratch timer that runs behind the completion screen. Same as
 *                `scratch`, plus it is discarded when that screen is left.
 */
export type TimerKind = 'user' | 'scratch' | 'transient'

export interface TimerState {
  focusText: string
  predictedSeconds: number | null // null = timebox mode
  startTime: Date
  adjustmentSeconds: number
  tags: string[]
  kind: TimerKind
  /** Milliseconds already spent on hold, not counting an ongoing hold. */
  heldMs: number
  /** When this timer was put on hold, or null while it is the one on screen. */
  heldSince: Date | null
}

export interface TimerComputed {
  /**
   * Seconds this timer spent on screen. This is what the countdown counts, and what is
   * recorded as the session's actual time - the wall clock a held timer spent waiting
   * is deliberately not kept anywhere.
   */
  elapsed: number
  remaining: number
  isOvertime: boolean
}

export type TimerEvent =
  | { type: 'started'; state: TimerState }
  | { type: 'adjusted'; delta: number; state: TimerState }
  | { type: 'suspended'; state: TimerState }
  | { type: 'resumed'; state: TimerState }
  | { type: 'tick'; elapsed: number; remaining: number; isOvertime: boolean }
  | { type: 'overtime_entered'; focusText: string; elapsed: number }
  | { type: 'overtime_exited' }
  | { type: 'completed'; state: TimerState; elapsed: number }
  | { type: 'canceled'; state: TimerState; elapsed: number }

type Listener = (event: TimerEvent) => void

/** A timer the user started, and so the only kind worth saving or holding. */
export function isUserTimer(state: TimerState | null): boolean {
  return state?.kind === 'user'
}

/**
 * A stack of timers. The top of the stack is the timer on screen, and it is the only
 * one that accrues time - everything under it is held: frozen, silent, untouched.
 *
 * There is no navigation on purpose. The only way back to a held timer is to complete
 * or cancel the one on top of it. See docs/stacked-timers.md.
 *
 * Invariants, which hold whenever an event is emitted - the stack is put right before
 * anyone is told about the change:
 * - the stack is never empty once initialized, so there is always a countdown on screen
 * - only the top may be a `scratch`/`transient` timer; held timers are always `user`
 * - only the top is running; every other entry has `heldSince` set
 */
export class TimerMachine {
  private stack: TimerState[] = []
  private listeners = new Set<Listener>()
  private tickInterval: number | null = null
  private wasOvertime = false

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(event: TimerEvent) {
    this.listeners.forEach(fn => fn(event))
  }

  /** The timer on screen. */
  getState(): TimerState | null {
    return this.stack[this.stack.length - 1] ?? null
  }

  /** The whole stack, bottom first. */
  getStack(): readonly TimerState[] {
    return [...this.stack]
  }

  /** The timers on hold, bottom first. Never includes the one on screen. */
  getHeldStates(): readonly TimerState[] {
    return this.stack.slice(0, -1)
  }

  getComputed(): TimerComputed | null {
    const state = this.getState()
    return state ? this.computedFor(state) : null
  }

  /**
   * Time for any timer, held or not. A held timer's elapsed stays put: wall time keeps
   * growing but the ongoing hold grows with it, so the two cancel out.
   */
  computedFor(state: TimerState): TimerComputed {
    const now = Date.now()
    const wallMs = now - state.startTime.getTime()
    const heldMs = state.heldMs + (state.heldSince ? now - state.heldSince.getTime() : 0)
    const elapsed = Math.floor((wallMs - heldMs) / 1000)
    const remaining = (state.predictedSeconds ?? 0) + state.adjustmentSeconds - elapsed
    return { elapsed, remaining, isOvertime: remaining < 0 }
  }

  /**
   * Start a timer. If the one on screen is a placeholder it is replaced; if it is a
   * real timer it goes on hold underneath.
   *
   * The caller is responsible for the stack depth cap - the machine does not know
   * about settings.
   */
  push(
    focusText: string,
    predictedSeconds: number | null,
    adjustmentSeconds: number,
    tags: string[]
  ) {
    const top = this.getState()
    if (top && !isUserTimer(top)) {
      this.stack.pop() // placeholders are discarded, never held and never saved
    } else if (top) {
      this.replaceTop({ ...top, heldSince: new Date() })
      this.emit({ type: 'suspended', state: this.getState()! })
    }

    this.stack.push({
      focusText,
      predictedSeconds,
      startTime: new Date(),
      adjustmentSeconds,
      tags,
      kind: 'user',
      heldMs: 0,
      heldSince: null,
    })
    this.wasOvertime = false
    this.ensureTicking()
    this.emit({ type: 'started', state: this.getState()! })
  }

  adjust(delta: number) {
    const top = this.getState()
    if (!top) return
    this.replaceTop({ ...top, adjustmentSeconds: top.adjustmentSeconds + delta })
    this.emit({ type: 'adjusted', delta, state: this.getState()! })
  }

  /**
   * Finish the timer on screen. A transient placeholder takes its place so that the
   * held timer stays frozen while the completion screen is up - see dismissTransient().
   */
  complete(): { state: TimerState; elapsed: number } | null {
    if (!isUserTimer(this.getState())) return null
    const result = this.popTop()
    this.pushPlaceholder('transient')
    this.emit({ type: 'completed', ...result })
    return result
  }

  /**
   * Bin the timer on screen and reveal whatever was underneath. Cancelling a
   * placeholder just restarts its countdown, which is what `q` has always done.
   */
  cancel(): { state: TimerState; elapsed: number } | null {
    const top = this.getState()
    if (!top) return null
    if (top.kind !== 'user') {
      this.stack.pop()
      this.pushPlaceholder(top.kind)
      return null
    }
    const result = this.popTop()
    this.resumeTop()
    this.emit({ type: 'canceled', ...result })
    return result
  }

  /**
   * Leave the completion screen: drop the transient placeholder and hand the clock back
   * to the held timer. With nothing held it simply becomes the idle timer, so its
   * countdown carries on rather than restarting.
   */
  dismissTransient() {
    const top = this.getState()
    if (top?.kind !== 'transient') return

    if (this.stack.length === 1) {
      this.replaceTop({ ...top, kind: 'scratch' })
      this.emit({ type: 'resumed', state: this.getState()! })
      return
    }

    this.stack.pop()
    this.resumeTop()
  }

  /** Drop everything and go back to a single idle countdown. */
  reset() {
    this.stack = []
    this.pushPlaceholder('scratch')
  }

  private replaceTop(state: TimerState) {
    this.stack[this.stack.length - 1] = state
  }

  private popTop() {
    const state = this.stack.pop()!
    return { state, elapsed: this.computedFor(state).elapsed }
  }

  private pushPlaceholder(kind: 'scratch' | 'transient') {
    this.stack.push({
      focusText: '',
      predictedSeconds: null,
      startTime: new Date(),
      adjustmentSeconds: DEFAULT_COUNTDOWN_SECONDS,
      tags: [],
      kind,
      heldMs: 0,
      heldSince: null,
    })
    this.wasOvertime = false
    this.ensureTicking()
    this.emit({ type: 'started', state: this.getState()! })
  }

  private resumeTop() {
    if (this.stack.length === 0) {
      this.pushPlaceholder('scratch')
      return
    }
    const top = this.getState()!
    if (top.heldSince) {
      this.replaceTop({
        ...top,
        heldMs: top.heldMs + (Date.now() - top.heldSince.getTime()),
        heldSince: null,
      })
    }
    // Clearing this makes a timer that is still in overtime ring once as it comes back,
    // which is exactly when you want to hear that it has already blown its prediction.
    this.wasOvertime = false
    this.ensureTicking()
    this.emit({ type: 'resumed', state: this.getState()! })
  }

  /**
   * Idempotent: the tick runs for the life of the machine, since there is always a
   * countdown on screen. Called wherever the stack changes so the very first timer
   * starts it, and so a reader does not have to know that it never stops.
   */
  private ensureTicking() {
    if (this.tickInterval) return
    this.tickInterval = window.setInterval(() => this.tick(), TIMER_TICK_INTERVAL)
    this.tick()
  }

  private tick() {
    const state = this.getState()
    if (!state) return
    const computed = this.computedFor(state)

    this.emit({
      type: 'tick',
      elapsed: computed.elapsed,
      remaining: computed.remaining,
      isOvertime: computed.isOvertime,
    })

    // Detect overtime transitions
    if (computed.isOvertime && !this.wasOvertime) {
      this.emit({
        type: 'overtime_entered',
        focusText: state.focusText,
        elapsed: computed.elapsed,
      })
    }
    if (!computed.isOvertime && this.wasOvertime) {
      this.emit({ type: 'overtime_exited' })
    }
    this.wasOvertime = computed.isOvertime
  }
}

// Singleton instance
export const timerMachine = new TimerMachine()
