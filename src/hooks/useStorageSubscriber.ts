import { useEffect } from 'react'
import { timerMachine } from '../lib/timer-machine'
import { platform } from '../lib/platform'

/**
 * Subscriber hook that handles session persistence.
 * Saves sessions on complete, cancel, and window close (Tauri only).
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

      if (event.type === 'canceled') {
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

    // Handle window close: save with status 'unknown'
    // On web this is a no-op (web platform returns an empty cleanup fn)
    const unlistenPromise = platform.onCloseRequested(async () => {
      const state = timerMachine.getState()
      if (state) {
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
