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

/**
 * Format a date as relative time: "just now", "2m ago", "1h 30m ago", "Yesterday", etc.
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const secondDiff = Math.floor(diffMs / 1000);
  const dayDiff = Math.floor(secondDiff / 86400);

  if (dayDiff < 0) {
    return formatTimestamp(date);
  }

  if (dayDiff === 0) {
    if (secondDiff < 10) {
      return "just now";
    }
    if (secondDiff < 60) {
      return `${secondDiff}s ago`;
    }
    if (secondDiff < 120) {
      return `1m ${secondDiff % 60}s ago`;
    }
    if (secondDiff < 3600) {
      return `${Math.floor(secondDiff / 60)}m ago`;
    }
    if (secondDiff < 7200) {
      return `1h ${Math.floor((secondDiff % 3600) / 60)}m ago`;
    }
    if (secondDiff < 86400) {
      return `${Math.floor(secondDiff / 3600)}h ago`;
    }
  }
  if (dayDiff <= 1) {
    return "Yesterday";
  }
  if (dayDiff < 7) {
    return `${dayDiff} days ago`;
  }
  if (dayDiff < 31) {
    return `${Math.floor(dayDiff / 7)} weeks ago`;
  }
  if (dayDiff < 365) {
    return `${Math.floor(dayDiff / 30)} months ago`;
  }
  return `${Math.floor(dayDiff / 365)} years ago`;
}

/**
 * Format a date as absolute time: "at 14:30", "Yest at 14:30", "Mon at 14:30", etc.
 */
export function formatAbsoluteTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const dayDiff = Math.floor(diffMs / (1000 * 86400));

  if (dayDiff < 0) {
    return formatTimestamp(date);
  }

  const pad = (n: number) => n.toString().padStart(2, '0');
  const timeStr = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  if (dayDiff === 0) {
    return `at ${timeStr}`;
  }
  if (dayDiff === 1) {
    return `Yest at ${timeStr}`;
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (dayDiff < 7) {
    return `${dayNames[date.getDay()]} at ${timeStr}`;
  }
  if (dayDiff < 31 && now.getMonth() === date.getMonth()) {
    return `${dayNames[date.getDay()]} ${date.getDate()} at ${timeStr}`;
  }
  if (now.getFullYear() === date.getFullYear()) {
    return `${dayNames[date.getDay()]} ${date.getDate()} ${monthNames[date.getMonth()]} at ${timeStr}`;
  }
  return `${dayNames[date.getDay()]} ${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()} at ${timeStr}`;
}

/**
 * Format a date as relative or absolute time.
 */
export function formatTime(date: Date, relative = true): string {
  return relative ? formatRelativeTime(date) : formatAbsoluteTime(date);
}
