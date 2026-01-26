/**
 * Parse a duration string into seconds.
 * Supports formats:
 * - "12m 30s" → 750
 * - "12m" → 720
 * - "90s" → 90
 * - "12:30" → 750 (mm:ss)
 * - "1:30:00" → 5400 (h:mm:ss)
 * - "1h 30m" → 5400
 * - "12" → 720 (assumes minutes)
 * - "1.5h" → 5400
 */
export function parseTime(input: string): number | null {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) return null

  // Try colon format first: h:mm:ss or mm:ss
  const colonMatch = trimmed.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/)
  if (colonMatch) {
    const parts = [colonMatch[1], colonMatch[2], colonMatch[3]].filter(Boolean).map(Number)
    if (parts.length === 2) {
      // mm:ss
      const [mins, secs] = parts
      if (secs >= 60) return null
      return mins * 60 + secs
    } else if (parts.length === 3) {
      // h:mm:ss
      const [hours, mins, secs] = parts
      if (mins >= 60 || secs >= 60) return null
      return hours * 3600 + mins * 60 + secs
    }
  }

  // Try compound format: 1h 30m 45s (any combination)
  const compoundRegex = /^(?:(\d+(?:\.\d+)?)\s*h(?:ours?)?)?[\s,]*(?:(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?)?[\s,]*(?:(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?)?$/
  const compoundMatch = trimmed.match(compoundRegex)
  if (compoundMatch && (compoundMatch[1] || compoundMatch[2] || compoundMatch[3])) {
    const hours = parseFloat(compoundMatch[1] || '0')
    const mins = parseFloat(compoundMatch[2] || '0')
    const secs = parseFloat(compoundMatch[3] || '0')
    return Math.round(hours * 3600 + mins * 60 + secs)
  }

  // Try single unit: "90s", "12m", "1.5h"
  const singleMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(h(?:ours?)?|m(?:in(?:ute)?s?)?|s(?:ec(?:ond)?s?)?)$/)
  if (singleMatch) {
    const value = parseFloat(singleMatch[1])
    const unit = singleMatch[2][0]
    switch (unit) {
      case 'h': return Math.round(value * 3600)
      case 'm': return Math.round(value * 60)
      case 's': return Math.round(value)
    }
  }

  // Try plain number (assumes minutes)
  const plainMatch = trimmed.match(/^(\d+(?:\.\d+)?)$/)
  if (plainMatch) {
    return Math.round(parseFloat(plainMatch[1]) * 60)
  }

  return null
}

import { parseSeconds } from './format'

/**
 * Format seconds as human-readable interpretation for preview.
 * "12 minutes", "1 hour 30 minutes", etc.
 */
export function formatTimePreview(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`
  }

  const { hours, mins, secs } = parseSeconds(seconds)

  const parts: string[] = []
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`)
  if (mins > 0) parts.push(`${mins} minute${mins !== 1 ? 's' : ''}`)
  if (secs > 0 && hours === 0) parts.push(`${secs} second${secs !== 1 ? 's' : ''}`)

  return parts.join(' ')
}
