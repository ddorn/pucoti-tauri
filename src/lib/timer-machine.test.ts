import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TimerMachine, isUserTimer, type TimerEvent } from './timer-machine'

// The machine reaches for window.setInterval to drive its tick. The node test
// environment already has setInterval on globalThis, so this is all the DOM it needs.
;(globalThis as unknown as { window: unknown }).window = globalThis

const MINUTE = 60_000

describe('TimerMachine', () => {
  let machine: TimerMachine

  beforeEach(() => {
    vi.useFakeTimers()
    machine = new TimerMachine()
    machine.reset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const events = () => {
    const seen: TimerEvent[] = []
    machine.subscribe(e => {
      if (e.type !== 'tick') seen.push(e)
    })
    return seen
  }

  describe('starting timers', () => {
    it('starts on an idle countdown that is not a real timer', () => {
      expect(machine.getStack()).toHaveLength(1)
      expect(isUserTimer(machine.getState())).toBe(false)
    })

    it('replaces the idle countdown rather than holding it', () => {
      machine.push('write the intro', 1500, 0, [])
      expect(machine.getStack()).toHaveLength(1)
      expect(machine.getState()?.focusText).toBe('write the intro')
      expect(machine.getHeldStates()).toHaveLength(0)
    })

    it('holds a real timer underneath', () => {
      machine.push('write the intro', 1500, 0, [])
      machine.push('call Marc back', 360, 0, [])

      expect(machine.getStack()).toHaveLength(2)
      expect(machine.getState()?.focusText).toBe('call Marc back')
      expect(machine.getHeldStates().map(s => s.focusText)).toEqual(['write the intro'])
    })

    it('announces the hold so the bell can go quiet', () => {
      machine.push('write the intro', 1500, 0, [])
      const seen = events()
      machine.push('call Marc back', 360, 0, [])
      expect(seen.map(e => e.type)).toEqual(['suspended', 'started'])
    })
  })

  describe('held time', () => {
    it('freezes a held timer', () => {
      machine.push('write the intro', 1500, 0, [])
      vi.advanceTimersByTime(MINUTE)
      machine.push('call Marc back', 360, 0, [])
      vi.advanceTimersByTime(5 * MINUTE)

      const held = machine.getHeldStates()[0]
      expect(machine.computedFor(held).elapsed).toBe(60)
    })

    it('picks up where it left off when it comes back', () => {
      machine.push('write the intro', 1500, 0, [])
      vi.advanceTimersByTime(MINUTE)
      machine.push('call Marc back', 360, 0, [])
      vi.advanceTimersByTime(5 * MINUTE)
      machine.cancel()
      vi.advanceTimersByTime(2 * MINUTE)

      expect(machine.getState()?.focusText).toBe('write the intro')
      expect(machine.getComputed()?.elapsed).toBe(180)
    })

    it('only the timer on screen counts down', () => {
      machine.push('write the intro', 600, 0, [])
      vi.advanceTimersByTime(MINUTE)
      machine.push('call Marc back', 300, 0, [])
      vi.advanceTimersByTime(MINUTE)

      expect(machine.getComputed()?.remaining).toBe(240) // the one on screen ran
      const held = machine.getHeldStates()[0]
      expect(machine.computedFor(held).remaining).toBe(540) // the held one did not
    })
  })

  describe('completing', () => {
    it('reports only the time spent on screen, not the time spent waiting', () => {
      machine.push('write the intro', 1500, 0, [])
      vi.advanceTimersByTime(MINUTE)
      machine.push('call Marc back', 360, 0, [])
      vi.advanceTimersByTime(5 * MINUTE)
      machine.cancel() // back on 'write the intro', which waited 5 minutes
      vi.advanceTimersByTime(MINUTE)

      expect(machine.complete()!.elapsed).toBe(120)
    })

    it('leaves a transient countdown on top so the held timer stays frozen', () => {
      machine.push('write the intro', 1500, 0, [])
      machine.push('call Marc back', 360, 0, [])
      machine.complete()

      expect(machine.getState()?.kind).toBe('transient')
      expect(machine.getHeldStates().map(s => s.focusText)).toEqual(['write the intro'])

      vi.advanceTimersByTime(5 * MINUTE)
      expect(machine.computedFor(machine.getHeldStates()[0]).elapsed).toBe(0)
    })

    it('hands the clock back when the completion screen is left', () => {
      machine.push('write the intro', 1500, 0, [])
      machine.push('call Marc back', 360, 0, [])
      machine.complete()
      vi.advanceTimersByTime(5 * MINUTE)
      machine.dismissTransient()

      expect(machine.getState()?.focusText).toBe('write the intro')
      expect(machine.getStack()).toHaveLength(1)
      expect(machine.getComputed()?.elapsed).toBe(0)
    })

    it('keeps the countdown running when nothing was held', () => {
      machine.push('write the intro', 1500, 0, [])
      machine.complete()
      vi.advanceTimersByTime(MINUTE)
      machine.dismissTransient()

      expect(machine.getStack()).toHaveLength(1)
      expect(machine.getState()?.kind).toBe('scratch')
      // Not restarted: the minute spent on the completion screen still counts.
      expect(machine.getComputed()?.elapsed).toBe(60)
    })

    it('does nothing on a timer that is not transient', () => {
      machine.push('write the intro', 1500, 0, [])
      machine.dismissTransient()
      expect(machine.getState()?.focusText).toBe('write the intro')
    })
  })

  describe('cancelling', () => {
    it('bins the timer on screen and reveals what was under it', () => {
      machine.push('write the intro', 1500, 0, [])
      machine.push('call Marc back', 360, 0, [])
      const seen = events()
      machine.cancel()

      expect(seen.map(e => e.type)).toEqual(['resumed', 'canceled'])
      expect(machine.getState()?.focusText).toBe('write the intro')
    })

    it('restarts the idle countdown instead of emptying the stack', () => {
      vi.advanceTimersByTime(MINUTE)
      const seen = events()
      machine.cancel()

      expect(machine.getStack()).toHaveLength(1)
      expect(machine.getComputed()?.elapsed).toBe(0)
      // Nothing was binned, so nothing is worth saving.
      expect(seen.some(e => e.type === 'canceled')).toBe(false)
    })
  })

  describe('placeholders are never saved', () => {
    it('does not emit completed for the idle countdown', () => {
      const seen = events()
      expect(machine.complete()).toBeNull()
      expect(seen.some(e => e.type === 'completed')).toBe(false)
    })

    it('does not emit completed for the transient countdown', () => {
      machine.push('write the intro', 1500, 0, [])
      machine.complete()
      const seen = events()
      expect(machine.complete()).toBeNull()
      expect(seen.some(e => e.type === 'completed')).toBe(false)
    })
  })

  describe('the stack is consistent before anyone is told', () => {
    it('never shows a held timer sitting on top', () => {
      machine.push('write the intro', 1500, 0, [])
      machine.push('call Marc back', 360, 0, [])

      const tops: (Date | null | undefined)[] = []
      machine.subscribe(e => {
        if (e.type !== 'tick') tops.push(machine.getState()?.heldSince)
      })
      machine.cancel()
      machine.complete()

      expect(tops.every(heldSince => heldSince === null)).toBe(true)
    })
  })

  describe('overtime', () => {
    it('rings again when a timer comes back still over its prediction', () => {
      machine.push('write the intro', 60, 0, [])
      vi.advanceTimersByTime(2 * MINUTE) // blows the prediction, rings

      machine.push('call Marc back', 300, 0, [])
      const seen = events()
      machine.cancel() // back on the overdue timer
      vi.advanceTimersByTime(1000)

      expect(seen.some(e => e.type === 'overtime_entered')).toBe(true)
    })
  })
})
