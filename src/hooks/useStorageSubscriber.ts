import { useEffect } from 'react'
import { timerMachine } from '../lib/timer-machine'
import { appendSession } from '../lib/storage'
import { getCurrentWindow } from '@tauri-apps/api/window'

/**
 * Subscriber hook that handles session persistence to CSV.
 * Saves sessions on complete, cancel, and window close.
 */
export function useStorageSubscriber() {
  useEffect(() => {
    const unsubscribe = timerMachine.subscribe(event => {
      if (event.type === 'completed') {
        appendSession({
          timestamp: event.state.startTime,
          focusText: event.state.focusText,
          predictedSeconds: event.state.predictedSeconds ?? 0,
          actualSeconds: event.elapsed,
          status: 'completed',
          tags: event.state.tags,
        }).catch(err => console.error('Failed to save session:', err))
      }

      if (event.type === 'canceled' && event.state.focusText) {
        appendSession({
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
    const window = getCurrentWindow()
    const unlistenPromise = window.onCloseRequested(async () => {
      const state = timerMachine.getState()
      if (state?.focusText) {
        const computed = timerMachine.getComputed()
        try {
          await appendSession({
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
