# Stacked timers

The design for putting a timer on hold when something interrupts you.

## The problem

The most common reason a prediction is wrong is that something else came up. Today
starting a new timer *cancels* the running one, so an interruption destroys the task
you were on: its intent, its prediction and its elapsed time are all gone.

## The model: a pile, not a tree

Live timers form a **stack**. The top of the stack is the timer on screen, and it is
the only one that accrues time. Everything under it is **held**: frozen, silent,
untouched.

There are exactly three operations:

- **push** — start a new timer; the one below goes on hold
- **complete** — the timer on top finishes and pops
- **cancel** — the timer on top is binned and pops

There is deliberately **no navigation**. You cannot rotate between timers, reorder
them, or look at one without ending the one above it. The only way back to what you
were doing is to finish or bin the thing on top of it.

That constraint is the feature. A pile you can freely browse is a task switcher; a
pile you can only unwind costs something every time you add to it, which is the
pressure we actually want against being interrupted.

### Why the held timer freezes

Pucoti's rule has always been "no pause — time always moves forward". Freezing a held
timer does not break it, because nothing is ever paused with *nothing* running:

> **Exactly one timer accrues: the one on screen.**

That is the same invariant as before, unchanged. The time a timer spends waiting is not
recorded anywhere — see [Storage](#storage) for why that is deliberate.

### Invariants

These kill most of the edge cases, and are worth preserving:

- **A placeholder is only ever on top.** It is never held (a push over one *replaces*
  it) and never pushed over.
- **A held timer is always a timer the user started** (`kind: 'user'`). It may still have
  no intent — a duration-only timebox is a real timer — so nothing may assume it has one.
- The stack is never empty: when the last timer pops, a fresh blank one takes its place.
- The stack does not survive a restart.

## Interaction

### The one rule

> **`Shift`+`Enter` starts a new timer.** It always opens the palette. What happens to
> the current timer follows from whether it is real: **blank → replaced, real → held.**

No new concept has to be tracked, and `Enter` keeps both of the meanings it has today.

### Every path

| State | Key | Effect |
| --- | --- | --- |
| Blank timer | `Enter` / `Shift`+`Enter` | open the palette (will replace) |
| Real timer | `Enter` | complete → completion screen, pop |
| Real timer | `Shift`+`Enter` | open the palette (will hold the current timer) |
| Real timer, at the cap | `Shift`+`Enter` | warning: *"3 timers already — finish one or bin it first."* Nothing else changes: no palette, and no switch out of corner or zen mode. |
| Any | `q` | cancel the timer on screen, pop |
| Palette | `Enter` | start (empty input → close; no duration → warn, then confirm) |
| Palette | `Shift`+`Enter` | start without a prediction |
| Palette | `Tab` | re-fetch the prefill command |
| Palette | `Esc` | close, current timer untouched |

`j` / `k` / digits / `Space` / `Tab` / `c` / `s` / `,` are unchanged and act on the
timer on screen.

`q` gets *simpler*: it used to cancel and reset to a blank countdown, and now it just
pops. What it means to the user is identical — bin this timer — only what is revealed
underneath differs.

### Replacing a running timer

There is no replace-in-place path, by choice. To swap what you are doing, `q` then
`Enter` — which is exactly the flow today, since `Enter` on a running timer already
completes rather than edits. Two keystrokes is the right price for destroying a running
timer, and it keeps the palette's submit keys from needing a fourth combination.

### Making the consequence visible

The palette is inline (the input replaces the intent line), so no new widget is needed.
When it will hold something, the hint grid says so by name:

```
Esc            Cancel
5m 30s         Duration syntax
Enter          Start · hold "Write the release post"
Shift+Enter    Start without prediction
Tab            Prefill
```

Over a placeholder, `Enter` reads **Start with prediction** and the hints are exactly
today's. When something is *already* held, one dimmed line sits above the input:
`On hold: Call Marc back` — as many names as the cap allows, truncated to one line.

At the cap the `Shift`+`Enter` hint is not shown at all, so a depth of 1 turns holding
off rather than advertising a shortcut that is always refused.

### The indicator

Normal mode shows one short sliver per held timer along the bottom edge of the screen —
a count, no text, no clocks. **Corner and zen modes show nothing**: space there is
precious, and the timer on screen should be as big as it can be.

The consequence is that a held timer is invisible while you are in the corner. The
signal, when it comes, is that the intent on screen changes to the revealed timer — and
with `onTimerStart: 'corner'` unset, cancelling also drops you back to the normal
window, which is hard to miss.

## Mechanics that are invisible but have to be decided

### The bell

Only the timer on screen rings — trivially, since it is the only one running.

Pushing must silence a ringing bell. Concretely, `wasOvertime` is reset when a timer is
suspended, so **resuming a timer that is still in overtime re-emits `overtime_entered`
and rings once**. Coming back to a task that has already blown its prediction is exactly
when you want to hear about it.

### The completion screen

Completing does not immediately resume the held timer. Instead:

1. `complete()` pops the finished timer and pushes a **transient** blank one — the same
   5m countdown that exists after a completion today. The held timer stays frozen.
2. The transient is dropped and the held timer picks up again when the **timer screen
   opens**, not when the completion screen closes. Leaving for Stats or Settings leaves
   the transient running, so a resume — and the corner-mode switch that rides on it —
   never fires while you are looking at another screen. With nothing held there is
   nothing to hand back to, so the transient simply becomes the idle timer and its
   countdown carries on rather than restarting.

So you get time to celebrate without a held timer's clock burning, and the two outcomes
are the ones you would want: something held → you land back on it; nothing held →
today's behaviour, unchanged. The transient timer is never saved.

### Closing the window

Every timer on the stack is saved with status `unknown`, not just the one on screen.

**Placeholder timers are never saved.** This also fixes an existing bug: today, closing
the app while sitting on the idle countdown (the boot state, or right after finishing a
timer) writes a junk row with no intent and a prediction of zero.

## Storage

**Nothing changes.** A session still records `actual_seconds`, and it still means "how
long this timer took" — it is now the time the timer spent *on screen*, which is what
the countdown was counting all along. Time a timer spent held behind another one is not
counted, and not recorded anywhere.

That last part is a deliberate loss. Keeping wall clock alongside would make
`wall - actual` the cost of your interruptions, and would let stats answer "on-time rate
when interrupted versus not". It would also cost a new column, a migration of every
existing `sessions.csv`, and a second notion of "how long did this take" running through
every stat, plot and table. The stat is worth having one day; it is not worth having
before anything reads it, and the column can be added later without disturbing what is
here now.

It also keeps the column **additive**, which matters more than it looks: held timers
overlap in wall clock, so a wall-clock column would count the same minutes twice when
summed across sessions. Time on screen never does.

## Settings

`maxStackDepth`, default 3 — the total number of live timers, so two held plus the one
on screen. At the cap, pushing is refused outright rather than warned about: a hard
rule is more honest for a discipline tool, and `q` is right there. At 1 the shortcut is
not offered at all, which is how you turn holding off.

## Prefill

The prefill command now runs when the palette **opens**, rather than behind
`Shift`+`Enter`, and its text arrives selected so typing replaces it.

This is what frees `Shift`+`Enter` to mean "start a new timer" everywhere with no
overload. It must not block: the input opens immediately and editable, the command
fires, and the result is dropped in only if nothing has been typed yet.

The prefilled text is often wrong on a push — the intention your external tool knows
about is usually the thing you are being interrupted *from* — but since it arrives
selected, discarding it costs one keystroke, which is cheaper than a rule about when to
prefill. `Tab` re-fetches it if you cleared it.

## What was considered and dropped

A fuller design was worked through first: live timers as a **tree**, where the active
path (the current timer and its ancestors) accrues, so that a sub-task could count
toward the project containing it while an interruption still froze what it interrupted.
It navigated with the arrow keys, listed the tree in the palette, and used a `+` sigil
to mark a new timer as a child.

It was dropped because the freedom pointed the wrong way. Making it *easy* to hold
several things and move between them is the opposite of the pressure this feature exists
to create, and it bought that freedom with four navigation keys, a sigil, a
complete-a-parent-with-children confirmation flow, and two extra CSV columns. The stack
gets the interruption case — the one that actually breaks predictions — for one key and
no change to storage at all.

The cost is real and worth stating: **rotating between two live tasks is not supported.**
Getting back to a held timer means completing or cancelling the one above it. Cancelling
is not data loss (the row is written with its true elapsed time), but it does end the
timer.
