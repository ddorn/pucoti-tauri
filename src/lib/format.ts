/**
 * Format seconds as mm:ss or h:mm:ss for display.
 */
export function formatCountdown(totalSeconds: number): string {
  const negative = totalSeconds < 0
  const abs = Math.abs(totalSeconds)

  const hours = Math.floor(abs / 3600)
  const mins = Math.floor((abs % 3600) / 60)
  const secs = abs % 60

  const pad = (n: number) => n.toString().padStart(2, '0')
  const sign = negative ? '-' : ''

  if (hours > 0) {
    return `${sign}${hours}:${pad(mins)}:${pad(secs)}`
  }
  return `${sign}${mins}:${pad(secs)}`
}

/**
 * Format seconds as compact string: "12m", "1h 30m", etc.
 */
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  if (hours > 0) {
    if (mins > 0) return `${hours}h ${mins}m`
    return `${hours}h`
  }
  if (mins > 0) {
    if (secs > 0) return `${mins}m ${secs}s`
    return `${mins}m`
  }
  return `${secs}s`
}

/**
 * Format a Date as ISO date string (YYYY-MM-DD HH:MM:SS)
 */
export function formatTimestamp(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
