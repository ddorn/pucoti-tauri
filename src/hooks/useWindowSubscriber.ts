import { useEffect, useRef } from 'react'
import { timerMachine } from '../lib/timer-machine'
import { useSettings } from '../context/SettingsContext'
import { setSmallMode, setNormalMode } from '../lib/window'

/**
 * Subscriber hook that handles window mode changes in response to timer events.
 * - On timer start: switch to small mode if configured
 * - On timer complete/cancel: switch to normal mode
 *
 * User-triggered window changes (space, tab, c keys) are handled by Timer.tsx directly.
 */
export function useWindowSubscriber(
  setDisplayMode: (mode: 'normal' | 'small' | 'zen') => void
) {
  const { settings } = useSettings()
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  useEffect(() => {
    const unsubscribe = timerMachine.subscribe(event => {
      const s = settingsRef.current

      if (event.type === 'started') {
        // Only corner mode if user actually set something (not just a blank reset)
        if (s.onTimerStart === 'corner' && (event.state.focusText || event.state.predictedSeconds !== null)) {
          setDisplayMode('small')
          setSmallMode(s).catch(console.error)
        }
      }

      if (event.type === 'completed' || event.type === 'canceled') {
        setDisplayMode('normal')
        setNormalMode(s).catch(console.error)
      }
    })

    return unsubscribe
  }, [setDisplayMode])
}
