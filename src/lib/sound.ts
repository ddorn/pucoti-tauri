import { sendNotification } from '@tauri-apps/plugin-notification'
import { executeCustomNotification } from './settings'

let bellAudio: HTMLAudioElement | null = null

export function playBell(): void {
  if (!bellAudio) {
    bellAudio = new Audio('/bell.mp3')
  }
  bellAudio.currentTime = 0
  bellAudio.play().catch(() => {
    // Autoplay might be blocked, that's ok
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
  } catch {
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
