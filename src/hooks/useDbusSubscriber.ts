import { useEffect, useRef } from 'react'
import { timerMachine } from '../lib/timer-machine'
import { useSettings } from '../context/SettingsContext'
import { isTauri } from '../lib/platform'

/**
 * Subscriber hook that syncs timer state to D-Bus for GNOME panel indicator.
 * Only runs when useGnomePanelIndicator setting is enabled AND running on GNOME.
 * Silently fails on non-GNOME platforms.
 * No-op on web (isTauri = false).
 */
export function useDbusSubscriber() {
  const { settings } = useSettings()
  const lastUpdateRef = useRef<string>('')

  useEffect(() => {
    // Only available in the Tauri desktop app
    if (!isTauri) return

    // Only subscribe if GNOME panel indicator is enabled
    if (!settings.useGnomePanelIndicator) {
      return
    }

    // Lazy-import Tauri APIs so they don't get bundled for web
    let unsubscribe: (() => void) | undefined
    let isActive = true

    Promise.all([
      import('@tauri-apps/api/core'),
      import('../lib/gnome-extension'),
    ]).then(([{ invoke }, { detectGnome }]) => {
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
    })

    return () => {
      isActive = false
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [settings.useGnomePanelIndicator])
}
