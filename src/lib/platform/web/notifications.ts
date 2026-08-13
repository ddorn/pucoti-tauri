export function playBell(_customBellPath?: string): void {
  // Ignore customBellPath on web — always use bundled bell
  const audio = new Audio('/bell.mp3')
  audio.play().catch(err => {
    console.error('Bell play failed:', err)
  })
}

export async function showNotification(
  title: string,
  body: string,
  _customCommand?: string,
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
