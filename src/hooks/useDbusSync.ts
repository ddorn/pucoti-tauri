import { useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { TimerState } from '../context/AppContext'

/**
 * Hook to sync timer state to the D-Bus service for GNOME panel indicator.
 * Updates are throttled to avoid redundant calls.
 * Silently fails on non-Linux platforms.
 */
export function useDbusSync(
  timerState: TimerState | null,
  remaining: number,
  isOvertime: boolean
) {
  const lastUpdateRef = useRef<string>('')

  useEffect(() => {
    const running = timerState !== null
    const focusText = timerState?.focusText ?? ''
    const remainingSeconds = Math.floor(remaining)

    // Create a key to detect actual changes
    const updateKey = `${running}:${remainingSeconds}:${focusText}:${isOvertime}`

    // Skip if nothing changed
    if (updateKey === lastUpdateRef.current) {
      return
    }
    lastUpdateRef.current = updateKey

    // Send update to D-Bus service (no-op on non-Linux)
    invoke('update_timer_state', {
      running,
      remainingSeconds,
      focusText,
      isOvertime,
    }).catch(() => {
      // Silently ignore errors (expected on non-Linux platforms)
    })
  }, [timerState, remaining, isOvertime])
}
