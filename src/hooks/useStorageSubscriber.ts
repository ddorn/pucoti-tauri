import { useEffect } from 'react'
import { timerMachine, isUserTimer } from '../lib/timer-machine'
import { platform } from '../lib/platform'

/**
 * Subscriber hook that handles session persistence.
 * Saves sessions on complete, cancel, and window close (Tauri only).
 */
export function useStorageSubscriber() {
  useEffect(() => {
    const unsubscribe = timerMachine.subscribe(event => {
      if (event.type === 'completed' || event.type === 'canceled') {
        platform
          .appendSession({
            timestamp: event.state.startTime,
            focusText: event.state.focusText,
            predictedSeconds: event.state.predictedSeconds ?? 0,
            actualSeconds: event.elapsed,
            status: event.type === 'completed' ? 'completed' : 'canceled',
            tags: event.state.tags,
          })
          .catch(err => console.error('Failed to save session:', err))
      }
    })

    // Handle window close: save every timer on the stack with status 'unknown'.
    // Placeholder timers (the idle countdown, and the one behind the completion screen)
    // are skipped - saving them is what used to leave junk rows with no intent.
    // On web this is a no-op (web platform returns an empty cleanup fn)
    const unlistenPromise = platform.onCloseRequested(async () => {
      for (const state of timerMachine.getStack()) {
        if (!isUserTimer(state)) continue
        const computed = timerMachine.computedFor(state)
        try {
          await platform.appendSession({
            timestamp: state.startTime,
            focusText: state.focusText,
            predictedSeconds: state.predictedSeconds ?? 0,
            actualSeconds: computed.elapsed,
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
