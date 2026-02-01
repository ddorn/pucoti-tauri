const TIMER_TICK_INTERVAL = 200 // milliseconds

export interface TimerState {
  focusText: string
  predictedSeconds: number | null // null = timebox mode
  startTime: Date
  adjustmentSeconds: number
  tags: string[]
}

export interface TimerComputed {
  elapsed: number
  remaining: number
  isOvertime: boolean
}

export type TimerEvent =
  | { type: 'started'; state: TimerState }
  | { type: 'adjusted'; delta: number; state: TimerState }
  | { type: 'tick'; elapsed: number; remaining: number; isOvertime: boolean }
  | { type: 'overtime_entered'; focusText: string; elapsed: number }
  | { type: 'overtime_exited' }
  | { type: 'completed'; state: TimerState; elapsed: number }
  | { type: 'canceled'; state: TimerState; elapsed: number }

type Listener = (event: TimerEvent) => void

const DEFAULT_COUNTDOWN_SECONDS = 300 // 5 minutes

export class TimerMachine {
  private state: TimerState | null = null
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

  getState(): TimerState | null {
    return this.state
  }

  getComputed(): TimerComputed | null {
    if (!this.state) return null
    const elapsed = Math.floor((Date.now() - this.state.startTime.getTime()) / 1000)
    const predicted = this.state.predictedSeconds ?? 0
    const remaining = predicted + this.state.adjustmentSeconds - elapsed
    return { elapsed, remaining, isOvertime: remaining < 0 }
  }

  start(
    focusText: string,
    predictedSeconds: number | null,
    adjustmentSeconds: number,
    tags: string[]
  ) {
    this.state = {
      focusText,
      predictedSeconds,
      startTime: new Date(),
      adjustmentSeconds,
      tags,
    }
    this.wasOvertime = false
    this.startTicking()
    this.emit({ type: 'started', state: this.state })
  }

  adjust(delta: number) {
    if (!this.state) return
    this.state = { ...this.state, adjustmentSeconds: this.state.adjustmentSeconds + delta }
    this.emit({ type: 'adjusted', delta, state: this.state })
  }

  complete(): { state: TimerState; elapsed: number } | null {
    if (!this.state) return null
    const computed = this.getComputed()!
    const result = { state: this.state, elapsed: computed.elapsed }
    this.stopTicking()
    this.state = null
    this.wasOvertime = false
    this.emit({ type: 'completed', ...result })
    return result
  }

  cancel(): { state: TimerState; elapsed: number } | null {
    if (!this.state) return null
    const computed = this.getComputed()!
    const result = { state: this.state, elapsed: computed.elapsed }
    this.stopTicking()
    this.state = null
    this.wasOvertime = false
    this.emit({ type: 'canceled', ...result })
    return result
  }

  // Reset to default state (5m countdown, no intent) - used after complete/cancel
  reset() {
    this.state = {
      focusText: '',
      predictedSeconds: null,
      startTime: new Date(),
      adjustmentSeconds: DEFAULT_COUNTDOWN_SECONDS,
      tags: [],
    }
    this.wasOvertime = false
    this.startTicking()
    this.emit({ type: 'started', state: this.state })
  }

  private startTicking() {
    if (this.tickInterval) return
    this.tickInterval = window.setInterval(() => this.tick(), TIMER_TICK_INTERVAL)
    this.tick() // Immediate first tick
  }

  private stopTicking() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval)
      this.tickInterval = null
    }
  }

  private tick() {
    const computed = this.getComputed()
    if (!computed || !this.state) return

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
        focusText: this.state.focusText,
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
