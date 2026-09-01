export type SessionStatus = 'completed' | 'canceled' | 'unknown'

export interface Session {
  timestamp: Date
  focusText: string
  predictedSeconds: number
  /** Wall clock: end - start, including time spent on hold behind another timer. */
  actualSeconds: number
  /**
   * Time the timer actually spent on screen - what the countdown counted, and so the
   * number to compare against the prediction. Equals actualSeconds when the timer was
   * never held, which is the case for every session recorded before stacked timers.
   *
   * It is also the only additive quantity: held timers overlap in wall clock, so
   * summing actualSeconds would count the same minutes twice.
   */
  focusSeconds: number
  status: SessionStatus
  tags: string[]
}

/** Time lost to interruptions. Zero unless the timer was held at some point. */
export function interruptedSeconds(session: Session): number {
  return Math.max(0, session.actualSeconds - session.focusSeconds)
}

export function wasInterrupted(session: Session): boolean {
  return interruptedSeconds(session) > 0
}
