import { useEffect, useRef } from 'react'
import { timerMachine } from '../lib/timer-machine'
import { useSettings } from '../context/SettingsContext'
import { playBell, showNotification } from '../lib/sound'
import { formatDuration } from '../lib/format'

/**
 * Subscriber hook that handles bell ringing and notifications
 * when the timer enters overtime.
 */
export function useBellSubscriber() {
  const { settings } = useSettings()
  const bellIntervalRef = useRef<number | null>(null)
  // Keep settings in ref so we can access latest values in subscription
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  useEffect(() => {
    const stopBellInterval = () => {
      if (bellIntervalRef.current) {
        clearInterval(bellIntervalRef.current)
        bellIntervalRef.current = null
      }
    }

    const unsubscribe = timerMachine.subscribe(event => {
      const s = settingsRef.current

      if (event.type === 'overtime_entered') {
        // Play initial bell
        playBell(s.customBellPath)

        // Show notification
        const message = event.focusText
          ? `You focused on ${event.focusText} for ${formatDuration(event.elapsed)}`
          : `Timer finished after ${formatDuration(event.elapsed)}`
        showNotification("Time's up!", message, s.notificationCommand)

        // Start repeating bell (if interval > 0)
        if (s.bellRepeatIntervalSeconds > 0) {
          bellIntervalRef.current = window.setInterval(
            () => playBell(settingsRef.current.customBellPath),
            s.bellRepeatIntervalSeconds * 1000
          )
        }
      }

      if (event.type === 'overtime_exited' || event.type === 'completed' || event.type === 'canceled') {
        stopBellInterval()
      }
    })

    return () => {
      unsubscribe()
      stopBellInterval()
    }
  }, []) // Empty deps - we use refs for settings
}
