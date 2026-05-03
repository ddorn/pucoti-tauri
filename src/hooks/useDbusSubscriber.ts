import { useEffect, useRef } from 'react'
import { timerMachine } from '../lib/timer-machine'
import { useSettings } from '../context/SettingsContext'
import { isTauri, platform } from '../lib/platform'

/**
 * Subscriber hook that syncs timer state to D-Bus for GNOME panel indicator.
 * Only runs when useGnomePanelIndicator setting is enabled AND running on GNOME.
 * Silently fails on non-GNOME platforms. No-op on web (isTauri = false).
 */
export function useDbusSubscriber() {
  const { settings } = useSettings()
  const lastUpdateRef = useRef<string>('')

  useEffect(() => {
    if (!isTauri || !settings.useGnomePanelIndicator) return

    let unsubscribe: (() => void) | undefined
    let isActive = true

    platform.gnome.detect().then(isGnome => {
      if (!isActive || !isGnome) return

      unsubscribe = timerMachine.subscribe(event => {
        if (event.type === 'tick') {
          const state = timerMachine.getState()
          const focusText = state?.focusText ?? ''
          const remainingSeconds = Math.floor(event.remaining)

          const key = `true:${remainingSeconds}:${focusText}:${event.isOvertime}`
          if (key === lastUpdateRef.current) return
          lastUpdateRef.current = key

          platform.gnome.updatePanel({
            running: true,
            remainingSeconds,
            focusText,
            isOvertime: event.isOvertime,
          })
        }

        if (event.type === 'completed' || event.type === 'canceled') {
          lastUpdateRef.current = ''
          platform.gnome.updatePanel({
            running: false,
            remainingSeconds: 0,
            focusText: '',
            isOvertime: false,
          })
        }
      })
    })

    return () => {
      isActive = false
      unsubscribe?.()
    }
  }, [settings.useGnomePanelIndicator])
}
