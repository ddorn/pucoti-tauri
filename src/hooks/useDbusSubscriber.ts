import { useEffect, useRef } from 'react'
import { timerMachine } from '../lib/timer-machine'
import { invoke } from '@tauri-apps/api/core'

/**
 * Subscriber hook that syncs timer state to D-Bus for GNOME panel indicator.
 * Silently fails on non-Linux platforms.
 */
export function useDbusSubscriber() {
  const lastUpdateRef = useRef<string>('')

  useEffect(() => {
    const unsubscribe = timerMachine.subscribe(event => {
      if (event.type === 'tick') {
        const state = timerMachine.getState()
        const focusText = state?.focusText ?? ''
        const remainingSeconds = Math.floor(event.remaining)

        // Throttle by checking if data changed
        const key = `true:${remainingSeconds}:${focusText}:${event.isOvertime}`
        if (key === lastUpdateRef.current) return
        lastUpdateRef.current = key

        invoke('update_timer_state', {
          running: true,
          remainingSeconds,
          focusText,
          isOvertime: event.isOvertime,
        }).catch(() => {}) // Silently ignore (expected on non-Linux)
      }

      if (event.type === 'completed' || event.type === 'canceled') {
        lastUpdateRef.current = ''
        invoke('update_timer_state', {
          running: false,
          remainingSeconds: 0,
          focusText: '',
          isOvertime: false,
        }).catch(() => {})
      }
    })

    return unsubscribe
  }, [])
}
