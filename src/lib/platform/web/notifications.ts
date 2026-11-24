// The web has no custom bell or notification command: both are files and shell
// commands on the user's machine. Leaving those parameters out still satisfies the
// Platform interface.

export function playBell(): void {
  const audio = new Audio(import.meta.env.BASE_URL + 'bell.mp3')
  audio.play().catch(err => {
    console.error('Bell play failed:', err)
  })
}

export async function showNotification(
  title: string,
  body: string,
): Promise<void> {
  if (!('Notification' in window)) {
    console.warn('Browser does not support notifications')
    return
  }

  if (Notification.permission === 'granted') {
    new Notification(title, { body })
    return
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      new Notification(title, { body })
    }
  }
}
