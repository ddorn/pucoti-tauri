# Predicoti - Focus Timer with Calibration

A timer app that helps you predict how long tasks take by tracking prediction vs actual time.

## Screens

### 1. New Focus
- Text field: "I'll focus on ___. I'll be done in ___."
- Time field: predicted duration
  - Generous parsing: "12m 30s", "12m", "90s", "12:30", "1h 30m", "12" (assumes minutes)
  - Show parsed interpretation below field
- Start button / `CTRL+Enter` → Timer screen

### 2. Timer
**Display:**
- Big Intent text (top)
- Bigger countdown (center)
- Regular "elapsed / predicted" below
- Shortcut hints (bottom)

**Behavior:**
- At 0: ring bell.mp3, OS notification, repeat bell ringing every 20s
- Past 0: show negative time in red

**Shortcuts:**
- `Tab` — Toggle zen mode (countdown only, minimal UI). Works from any mode.
- `j` / `k` — ±1 minute to countdown (doesn't change prediction)
- `Enter` — Complete session → confetti → New Focus
- `q` — Cancel session → New Focus
- `Space` — Toggle small corner mode (320×120, always-on-top, bottom-right corner). Works from any mode.
- `c` — Cycle corners (when small)

**Modes:**
- Normal: all UI visible
- Zen (`Tab`): countdown + intent text only, minimal UI, shortcuts still work
- Small (`Space`): 320×120, always-on-top, no navbar, no shortcut hints
- Zen and Small can transition to each other with Tab/Space

### 3. History
- **Calibration plot**: scatter of (predicted, actual) + linear regression line + y=x reference line
  - Only `completed` sessions shown on plot (canceled/unknown excluded)
- **Table**: timestamp, focus text, predicted, actual, status
- **Export CSV** button

### Navigation
- Navbar between screens (hidden in small/zen modes)
- Flow: New Focus → Timer → (confetti) → New Focus

## Data

**Storage:** CSV file, append-only
```
timestamp,focus_text,predicted_seconds,actual_seconds,status,tags
```
- `status`: `completed` | `canceled` | `unknown`
- Standard CSV escaping for focus_text and tags. Tags are not used yet.

**Tracking:**
- `completed`: user pressed Enter
- `canceled`: user pressed cancel shortcut
- `unknown`: app quit mid-session (detected via orphaned temp file on next launch)

On timer start, write `predicoti_active_session.json` in the app's data directory. On complete/cancel, delete it and append to CSV. On app launch, if temp file exists → append as `unknown` status, then delete temp file.

The csv file is in the app's data directory.

## Aesthetics

- Dark mode default, minimal and playful.

## Tech Stack

- Neutralinojs
- React
- Tailwind + Catalyst
- Plotly.js (calibration chart)
- Vitest (unit tests for parsing, regression, formatting)

## File Structure (tentative)
```
/src
  /components
  /screens
    NewFocus.tsx
    Timer.tsx
    History.tsx
  /lib
    time-parser.ts    # parse "12m 30s" etc
    regression.ts     # linear regression calc
    storage.ts        # CSV read/append + active session temp file
    format.ts         # seconds → display string
  App.tsx
/assets
  bell.mp3
/tests
  time-parser.test.ts
  regression.test.ts
neutralino.config.json
```

## Platforms

Support macOS, Windows, Linux. Window placement with neutralino or system commands run through neutralino for specific platforms (e.g. swaywm).

## Resources

Tailwind Catalist and sound are in the folder.

## Out of Scope (for now)
- Settings screen (corner size, sounds, etc.)
- Remember last corner position
- Single instance enforcement
- Edit/delete history entries
