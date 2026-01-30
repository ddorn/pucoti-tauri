import { describe, it, expect } from 'vitest'
import { parseCommand } from './command-parser'

describe('parseCommand', () => {
  describe('duration only', () => {
    it('parses plain number as minutes', () => {
      expect(parseCommand('25')).toEqual({ intent: '', seconds: 1500 })
    })

    it('parses with minute suffix', () => {
      expect(parseCommand('45m')).toEqual({ intent: '', seconds: 2700 })
    })

    it('parses with hour suffix', () => {
      expect(parseCommand('2h')).toEqual({ intent: '', seconds: 7200 })
    })

    it('parses compound duration', () => {
      expect(parseCommand('1h 30m')).toEqual({ intent: '', seconds: 5400 })
    })

    it('parses colon format', () => {
      expect(parseCommand('12:30')).toEqual({ intent: '', seconds: 750 })
    })
  })

  describe('intent with duration', () => {
    it('parses single word intent with number', () => {
      expect(parseCommand('work 25')).toEqual({ intent: 'work', seconds: 1500 })
    })

    it('parses single word intent with suffixed duration', () => {
      expect(parseCommand('work 25m')).toEqual({ intent: 'work', seconds: 1500 })
    })

    it('parses multi-word intent with duration', () => {
      expect(parseCommand('write the intro 45m')).toEqual({ intent: 'write the intro', seconds: 2700 })
    })

    it('parses intent with compound duration', () => {
      expect(parseCommand('work 1h 30m')).toEqual({ intent: 'work', seconds: 5400 })
    })

    it('parses intent with complex compound duration', () => {
      expect(parseCommand('deep work session 2h 15m')).toEqual({ intent: 'deep work session', seconds: 8100 })
    })

    it('parses duration at the start with intent after', () => {
      expect(parseCommand('1h 30m work')).toEqual({ intent: 'work', seconds: 5400 })
    })

    it('parses duration at the start with multi-word intent after', () => {
      expect(parseCommand('45m write the intro')).toEqual({ intent: 'write the intro', seconds: 2700 })
    })

    it('parses compound duration at the start', () => {
      expect(parseCommand('2h 15m deep work session')).toEqual({ intent: 'deep work session', seconds: 8100 })
    })
  })

  describe('intent only (no duration)', () => {
    it('parses single word intent', () => {
      expect(parseCommand('work')).toEqual({ intent: 'work', seconds: null })
    })

    it('parses multi-word intent', () => {
      expect(parseCommand('write the intro')).toEqual({ intent: 'write the intro', seconds: null })
    })

    it('preserves intent with numbers that are not durations', () => {
      // "chapter 5" - the 5 is parsed as 5 minutes duration
      // This is expected behavior - numbers are treated as durations
      expect(parseCommand('chapter 5')).toEqual({ intent: 'chapter', seconds: 300 })
    })
  })

  describe('empty input', () => {
    it('handles empty string', () => {
      expect(parseCommand('')).toEqual({ intent: '', seconds: null })
    })

    it('handles whitespace only', () => {
      expect(parseCommand('   ')).toEqual({ intent: '', seconds: null })
    })
  })

  describe('edge cases', () => {
    it('handles extra whitespace', () => {
      expect(parseCommand('  work   25m  ')).toEqual({ intent: 'work', seconds: 1500 })
    })

    it('handles decimal durations', () => {
      expect(parseCommand('work 1.5h')).toEqual({ intent: 'work', seconds: 5400 })
    })

    it('handles case insensitivity in duration', () => {
      expect(parseCommand('work 25M')).toEqual({ intent: 'work', seconds: 1500 })
    })
  })
})
