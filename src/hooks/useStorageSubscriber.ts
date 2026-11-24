import { useEffect } from 'react'
import { timerMachine, type TimerState } from '../lib/timer-machine'
import { platform } from '../lib/platform'

/**
 * A timer with neither intent nor prediction is the idle countdown Pucoti starts on and
 * returns to. It is not a session: starting a timer cancels it, and so does q, and
 * saving those left a junk row every time.
 */
function isWorthSaving(state: TimerState): boolean {
  return state.focusText !== '' || state.predictedSeconds !== null
}

/**
 * Subscriber hook that handles session persistence.
 * Saves sessions on complete, cancel, and when the window or tab closes.
 */
export function useStorageSubscriber() {
  useEffect(() => {
    const unsubscribe = timerMachine.subscribe(event => {
      if (event.type === 'completed') {
        platform.appendSession({
          timestamp: event.state.startTime,
          focusText: event.state.focusText,
          predictedSeconds: event.state.predictedSeconds ?? 0,
          actualSeconds: event.elapsed,
          status: 'completed',
          tags: event.state.tags,
        }).catch(err => console.error('Failed to save session:', err))
      }

      if (event.type === 'canceled' && isWorthSaving(event.state)) {
        platform.appendSession({
          timestamp: event.state.startTime,
          focusText: event.state.focusText,
          predictedSeconds: event.state.predictedSeconds ?? 0,
          actualSeconds: event.elapsed,
          status: 'canceled',
          tags: event.state.tags,
        }).catch(err => console.error('Failed to save session:', err))
      }
    })

    // Handle window or tab close: save with status 'unknown'
    const unlistenPromise = platform.onCloseRequested(async () => {
      const state = timerMachine.getState()
      if (state && isWorthSaving(state)) {
        const computed = timerMachine.getComputed()
        try {
          await platform.appendSession({
            timestamp: state.startTime,
            focusText: state.focusText,
            predictedSeconds: state.predictedSeconds ?? 0,
            actualSeconds: computed?.elapsed ?? 0,
            status: 'unknown',
            tags: state.tags,
          })
        } catch (err) {
          console.error('Failed to save session on window close:', err)
        }
      }
    })

    return () => {
      unsubscribe()
      unlistenPromise.then(fn => fn()).catch(console.error)
    }
  }, [])
}
