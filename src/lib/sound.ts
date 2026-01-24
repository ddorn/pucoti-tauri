import Neutralino, { Icon } from '@neutralinojs/lib'

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

export function showNotification(title: string, body: string): void {
  Neutralino.os.showNotification(title, body).catch(() => {
    // Fall back to browser notification
    fallbackNotification(title, body)
  })
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
