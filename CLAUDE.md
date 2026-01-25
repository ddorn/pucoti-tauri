# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pucoti is a Tauri-based desktop timer application focused on tracking predicted vs actual task durations and providing calibration statistics. It helps users improve their time estimation accuracy over time.

## Development Commands

### Frontend Development
```bash
npm run dev              # Run Vite dev server
npm run build            # Build frontend (TypeScript + Vite)
npm run lint             # Run ESLint
npm test                 # Run all tests with Vitest
npm run test:watch       # Run tests in watch mode
```

### Tauri Development
```bash
npm run tauri:dev        # Run Tauri in development mode (includes frontend dev server)
npm run tauri:build      # Build Tauri app as .deb package
npm run tauri            # Direct access to Tauri CLI
```

### Testing
- Test files: `src/lib/*.test.ts`
- Run single test file: `npx vitest src/lib/regression.test.ts`
- Tests cover time parsing and statistical calculations

## Architecture

### Frontend Stack
- **React 19** with TypeScript
- **Vite** for bundling
- **Tailwind CSS 4** for styling (via @tailwindcss/vite plugin)
- **Tauri 2** for desktop integration
- **Vitest** for testing

### State Management Architecture

The app uses React Context for global state with two primary providers:

1. **SettingsProvider** (`src/context/SettingsContext.tsx`)
   - Manages user settings (window sizes, notification commands, margins, etc.)
   - Persists settings to disk via Tauri filesystem API
   - Wraps entire app at top level

2. **AppProvider** (`src/context/AppContext.tsx`)
   - Core timer state and navigation
   - Timer modes: 'normal', 'zen', 'small' (affects UI and window behavior)
   - Timer lifecycle: start, adjust, complete, cancel
   - Lives inside SettingsProvider and calls `useSettings()` directly for access to all settings

**Bridge Component**: `App.tsx` contains `AppWithSettings` that provides lifecycle callbacks (onTimerStart, onTimerComplete, onTimerCancel) to AppProvider for window management. AppProvider accesses settings directly via `useSettings()` hook.

### Timer Engine (`src/hooks/useTimerEngine.ts`)

Core timer logic runs at app level (persists across screen navigation):
- Calculates elapsed/remaining time from `startTime` (not interval-based)
- Detects overtime and triggers notifications
- Manages bell ringing (plays once on overtime, then repeats every 20s)
- Updates display at 200ms intervals for smooth UI

Key insight: Timer state includes `adjustmentSeconds` to handle +/- time adjustments (j/k keys) without resetting the start time.

### Storage System (`src/lib/storage.ts`)

**Session Persistence**:
- All sessions saved to CSV: `~/.local/share/pucoti/sessions.csv`
- Format: timestamp, focus_text, predicted_seconds, actual_seconds, status, tags
- Status types: 'completed', 'canceled', 'unknown'

**Active Session Recovery**:
- Tracks current timer in `pucoti_active_session.json`
- On app launch, `recoverOrphanedSession()` checks for crashed sessions
- Orphaned sessions marked as 'unknown' status with estimated duration

### Statistics Engine (`src/lib/stats.ts`)

Provides calibration analytics:
- **Mean Bias**: percentage difference (positive = tasks took longer than predicted)
- **Confidence Intervals**: 95% CI for bias and regression slopes (when n ≥ 3)
- **On-time Rate**: percentage of sessions within predicted time
- **Adjustment Curve**: models what % buffer needed for X% on-time rate
- **Linear Regression**: predicts actual time from predicted time with R²

### Window Management (`src/lib/window.ts`)

Handles three window modes with special Sway WM support:

1. **Normal Mode**: Standard centered window (default 600x500)
2. **Small Mode**: Corner-positioned floating window (default 240x120)
3. **Zen Mode**: Fullscreen (UI-only, window API not involved)

**Sway-specific behavior**:
- Detects Sway via `$XDG_CURRENT_DESKTOP`
- Uses `swaymsg` for precise multi-monitor positioning
- Enables sticky mode for small windows
- Combines multiple commands in single swaymsg call for atomicity

**Multi-monitor handling**: Attempts to use current window's monitor rather than primary monitor.

### Time Parsing (`src/lib/time-parser.ts`)

Flexible duration input supporting:
- Compound: "1h 30m", "1h 30m 45s"
- Colon format: "12:30" (mm:ss), "1:30:00" (h:mm:ss)
- Single unit: "90s", "12m", "1.5h"
- Plain number: "12" (assumes minutes)

## Key Screens

1. **NewFocus** (`src/screens/NewFocus.tsx`): Start new timer with focus text and duration
2. **Timer** (`src/screens/Timer.tsx`): Active timer display with j/k adjustment keys
3. **Stats** (`src/screens/Stats.tsx`): Calibration plots and session history
4. **Settings** (`src/screens/Settings.tsx`): Configure window behavior and notifications

## Tauri Backend

Minimal Rust backend (`src-tauri/src/lib.rs`) provides:
- Shell command execution via tauri-plugin-shell
- Filesystem access via tauri-plugin-fs
- OS notifications via tauri-plugin-notification
- Custom shell commands: `run-sh`, `run-swaymsg` (defined in tauri.conf.json's shell scope)

Frontend communicates via `@tauri-apps/api` and plugin imports.

**Platform Support**: The application targets Windows, macOS, and Linux and should be compatible with all three platforms. Code should be written with cross-platform compatibility in mind.

## UI Components

- Custom component library in `src/components/catalyst/` (Tailwind-based)
- Application-specific components in `src/components/`
- Plotly.js for statistical visualizations

## Configuration Files

- `tauri.conf.json`: Tauri app config, window settings, shell command scope
- `vite.config.ts`: Frontend build config
- `package.json`: Scripts and dependencies
- `tsconfig.json`: TypeScript config (split into app/node configs)

## Important Patterns

### Reading/Writing Data
Always use Tauri APIs, never Node.js fs:
```typescript
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
```

### Shell Commands
Use Command API with scoped shells:
```typescript
import { Command } from '@tauri-apps/plugin-shell'
const cmd = Command.create('run-sh', ['-c', 'your command'])
```

### Settings Architecture

Settings are managed via SettingsContext and accessed through the `useSettings()` hook:

```typescript
const { settings, updateSettings } = useSettings()
await updateSettings({ normalWindowWidth: 800 })
```

**Adding a New Setting:**

1. Add the property to the `Settings` interface in `src/lib/settings.ts`
2. Add the default value to `DEFAULT_SETTINGS` in the same file
3. Add UI control in `src/screens/Settings.tsx` (if user-configurable)
4. Use the setting anywhere via `useSettings()` hook - no prop drilling needed

All components (including AppProvider) access settings via the same hook pattern for consistency.

### Session Management
- Start timer: saves to `pucoti_active_session.json`
- Complete/Cancel: appends to `sessions.csv`, clears active session
- On app launch: recovers orphaned session if exists

## Notes
- Keep this file (CLAUDE.MD) up to date.
