# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Pucoti** is a Pomodoro-style timer application with statistical tracking and calibration features. Built with Neutralinojs (cross-platform native desktop) + React + TypeScript + Tailwind CSS.

The app helps users track their time predictions vs actual time spent, providing statistical analysis to improve future time estimates through linear regression and calibration metrics.

## Development Commands

### Main Workflow (from root)
```bash
neu run                  # Start dev server (Vite) + run Neutralino app
neu build                # Package for distribution (cross-platform)
```

### Frontend Development (in `app/` directory)
```bash
cd app
npm install              # Install dependencies
npm run build            # Build React app (TypeScript + Vite)
npm run lint             # Run ESLint
npm test                 # Run Vitest tests once
npm test:watch           # Run Vitest in watch mode
```

## Architecture

### Tech Stack
- **Runtime**: Neutralinojs 6.4.0 (lightweight Electron alternative)
- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS 4.x with custom design system
- **UI Components**: Custom Catalyst components (in `app/src/components/catalyst/`)
- **Charts**: Plotly.js for statistical visualizations
- **Testing**: Vitest

### Key Architectural Patterns

#### 1. Context-Based State Management
Two main contexts manage application state:
- **AppContext** (`app/src/context/AppContext.tsx`): Timer state, screen navigation, timer mode (normal/zen/small)
- **SettingsContext** (`app/src/context/SettingsContext.tsx`): User preferences, window settings

The timer engine runs at the App level (via `useTimerEngine` hook) so it persists across screen navigation.

#### 2. Data Persistence
All data stored via Neutralino filesystem APIs:
- Sessions saved to CSV: `~/.local/share/pucoti/sessions.csv` (Linux) or equivalent on other platforms
- Active session tracking: `pucoti_active_session.json` (for crash recovery)
- Storage layer: `app/src/lib/storage.ts`

Session structure:
```
timestamp, focus_text, predicted_seconds, actual_seconds, status (completed|canceled|unknown), tags
```

#### 3. Screen Architecture
Single-page app with 4 main screens (no routing library):
- **NewFocus**: Create new timer with duration prediction
- **Timer**: Active timer display with adjustments (j/k keys)
- **Stats**: Statistical analysis with calibration metrics and plots
- **Settings**: Window mode preferences and notification commands

Screen switching managed by `screen` state in AppContext.

#### 4. Timer Modes & Window Control
Three display modes controlled via Neutralino window APIs (`app/src/lib/window.ts`):
- **normal**: Full-size window (600x500) with navigation
- **zen**: Fullscreen, no navigation
- **small**: Minimal floating window (250x180), positioned by corner preference

Mode transitions preserve timer state.

#### 5. Statistical Analysis
Core statistics in `app/src/lib/stats.ts`:
- **Calibration metrics**: Mean bias, confidence intervals, IQR of actual/predicted ratios
- **Linear regression**: With confidence intervals for slope
- **Adjustment curves**: Calculates adjustment % needed for target on-time rates

Custom hooks in `app/src/hooks/`:
- `useSessions.ts`: Load/filter session data
- `useStats.ts`: Compute statistics from sessions
- `useTimerEngine.ts`: Core timer logic with bell notifications

### Important Implementation Details

#### Time Parsing
`app/src/lib/time-parser.ts` supports multiple formats:
- Compound: "1h 30m", "12m 30s"
- Colon: "1:30:00" (h:mm:ss), "12:30" (mm:ss)
- Single unit: "90s", "12m", "1.5h"
- Plain number: "12" (assumes minutes)

#### Notification System
Two-tier notification approach:
1. Browser Notification API (via `@neutralinojs/lib`)
2. Optional custom shell command (configured in settings)

Bell sound repeats every 20 seconds during overtime until timer is completed/canceled.

#### Session Recovery
On app launch, `recoverOrphanedSession()` checks for active session from previous crash. Orphaned sessions saved with `status: 'unknown'`.

#### Test Files
Only `lib/` utilities have tests:
- `time-parser.test.ts`: Time parsing edge cases
- `regression.test.ts`: Statistical computation validation

## File Organization

```
app/src/
├── components/
│   ├── catalyst/          # Reusable UI components (Headless UI + Tailwind)
│   ├── CalibrationPlot.tsx
│   ├── AdjustmentPlot.tsx
│   ├── SessionTable.tsx
│   └── MiniTimer.tsx
├── context/               # Global state management
├── hooks/                 # Custom React hooks
├── lib/                   # Business logic utilities
│   ├── storage.ts         # Neutralino filesystem operations
│   ├── stats.ts           # Statistical calculations
│   ├── time-parser.ts     # Duration parsing
│   ├── window.ts          # Window mode control
│   ├── sound.ts           # Notifications & bell
│   ├── format.ts          # Display formatting
│   └── settings.ts        # Settings persistence
├── screens/               # Main application screens
└── types/                 # TypeScript type definitions
```

## Important Notes

- Always run frontend commands from `app/` directory, not root
- Neutralino config is at root: `neutralino.config.json`
- `npm run build` output goes to `app/build/` (configured in vite.config.ts) but `neu build` output goes to `dist/`.
- The app uses Neutralino native APIs for filesystem, OS info, and window control - these only work when running via `neu run`, not in browser-only dev mode
- Custom TypeScript module declaration for Plotly in `types/plotly.d.ts` (maps `plotly.js-dist-min` imports)
- Keep this file (CLAUDE.md) up-to-date.
