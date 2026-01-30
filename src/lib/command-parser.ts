import { parseTime } from './time-parser'

export interface ParsedCommand {
  intent: string        // Text portion (may be empty)
  seconds: number | null  // Duration in seconds (null if not parseable)
}

/**
 * Parse a command palette input into intent and duration.
 *
 * Examples:
 * - "work 25" → { intent: "work", seconds: 1500 }
 * - "work 1h 30m" → { intent: "work", seconds: 5400 }
 * - "25" → { intent: "", seconds: 1500 }
 * - "work" → { intent: "work", seconds: null }
 * - "write the intro 45m" → { intent: "write the intro", seconds: 2700 }
 * - "" → { intent: "", seconds: null }
 */
export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim()

  if (!trimmed) {
    return { intent: '', seconds: null }
  }

  // Strategy 1: Try parsing the entire input as a duration
  const fullParse = parseTime(trimmed)
  if (fullParse !== null && fullParse > 0) {
    return { intent: '', seconds: fullParse }
  }

  // Strategy 2: Try parsing from the end, starting with longer suffixes
  // This handles "work 25", "work 1h 30m", "write the intro 45m"
  const words = trimmed.split(/\s+/)

  // Try progressively shorter suffixes as duration
  // Start from most words (longer duration), then fewer words
  // This ensures "1h 30m" is tried before just "30m"
  for (let i = 0; i < words.length; i++) {
    const potentialDuration = words.slice(i).join(' ')
    const parsed = parseTime(potentialDuration)

    if (parsed !== null && parsed > 0) {
      const intent = words.slice(0, i).join(' ')
      return { intent, seconds: parsed }
    }
  }

  // Strategy 3: No duration found - entire input is intent
  return { intent: trimmed, seconds: null }
}
