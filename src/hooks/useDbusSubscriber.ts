import { useEffect, useRef } from 'react'
import { timerMachine } from '../lib/timer-machine'
import { invoke } from '@tauri-apps/api/core'
import { useSettings } from '../context/SettingsContext'
import { detectGnome } from '../lib/gnome-extension'

/**
 * Subscriber hook that syncs timer state to D-Bus for GNOME panel indicator.
 * Only runs when useGnomePanelIndicator setting is enabled AND running on GNOME.
 * Silently fails on non-GNOME platforms.
 */
export function useDbusSubscriber() {
  const { settings } = useSettings()
  const lastUpdateRef = useRef<string>('')

  useEffect(() => {
    // Only subscribe if GNOME panel indicator is enabled
    if (!settings.useGnomePanelIndicator) {
      return
    }

    // Check if we're actually running on GNOME
    let unsubscribe: (() => void) | undefined
    let isActive = true

    detectGnome().then(isGnome => {
      if (!isActive || !isGnome) {
        return
      }

      unsubscribe = timerMachine.subscribe(event => {
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
    })

    return () => {
      isActive = false
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [settings.useGnomePanelIndicator])
}
