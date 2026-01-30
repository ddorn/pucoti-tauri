import { sendNotification } from '@tauri-apps/plugin-notification'
import { invoke } from '@tauri-apps/api/core'
import { executeCustomNotification } from './settings'

/**
 * Plays a bell sound (custom or default).
 * NOTE: Currently only used when timer crosses 0 (goes into overtime).
 * If used elsewhere, update the notification settings documentation in Settings.tsx.
 */
export function playBell(customBellPath?: string): void {
  console.log('playBell called with customBellPath:', customBellPath || null)
  invoke('play_bell', {
    customBellPath: customBellPath || null
  }).then(() => {
    console.log('Bell invoke succeeded')
  }).catch((err) => {
    console.error('Bell play failed:', err)
  })
}

/**
 * Show notification using custom command if configured, else OS default.
 */
export async function showNotification(
  title: string,
  body: string,
  customCommand?: string
): Promise<void> {
  // Try custom command first if provided
  if (customCommand) {
    const success = await executeCustomNotification(title, body, customCommand)
    if (success) return
  }

  // Fall back to Tauri notification
  try {
    await sendNotification({ title, body })
  } catch (err) {
    console.error('Tauri notification failed, falling back to browser notification:', err)
    // Fall back to browser notification
    fallbackNotification(title, body)
  }
}

function fallbackNotification(title: string, body: string): void {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body })
  } else if ('Notification' in window && Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(title, { body })
      }
    })
  }
}
