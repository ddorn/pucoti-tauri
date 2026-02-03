# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pucoti is a Tauri-based desktop timer application focused on tracking predicted vs actual task durations and providing calibration statistics. It helps users improve their time estimation accuracy over time.

## Development Commands

### Tauri Development
```bash
npm run tauri:build      # Build Tauri app as .deb package. This is the main command to build the app.
npm run tauri:dev        # Run Tauri in development mode (includes frontend dev server)
npm run tauri            # Direct access to Tauri CLI
```

### Frontend Development
```bash
npm run lint             # Run ESLint
npm test                 # Run all tests with Vitest
npm run test:watch       # Run tests in watch mode
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

The app uses a centralized timer state machine with React hooks for subscriptions:

1. **SettingsProvider** (`src/context/SettingsContext.tsx`)
   - Manages user settings (window sizes, notification commands, margins, etc.)
   - Persists settings to disk via Tauri filesystem API
   - Wraps entire app at top level

2. **TimerMachine** (`src/lib/timer-machine.ts`) - **Singleton State Machine**
   - Pure TypeScript class (no React dependencies)
   - Single source of truth for all timer state
   - Commands: `start()`, `adjust()`, `complete()`, `cancel()`, `reset()`
   - Events: `started`, `adjusted`, `tick`, `overtime_entered`, `overtime_exited`, `completed`, `canceled`
   - State: `focusText`, `predictedSeconds`, `startTime`, `adjustmentSeconds`, `tags`
   - Computed values: `elapsed`, `remaining`, `isOvertime` (calculated from `startTime`, not interval-based)
   - Updates at 200ms intervals for smooth UI

3. **AppProvider** (`src/context/AppContext.tsx`)
   - Manages UI state only: `screen`, `displayMode`, `completionData`
   - Mounts subscriber hooks that react to timer events
   - Components access UI state via `useApp()` hook

**Key Pattern**: Components call `timerMachine` directly for commands (e.g., `timerMachine.start()`, `timerMachine.adjust(60)`). No wrapper functions needed.

### Timer Subscribers (Event-Driven Side Effects)

The timer machine uses an event-driven architecture where independent subscriber hooks handle side effects:

1. **useBellSubscriber** (`src/hooks/useBellSubscriber.ts`)
   - Plays bell on `overtime_entered` event
   - Shows OS notification with elapsed time
   - Manages repeating bell interval (configurable, default 20s)
   - Uses `useSettings()` for bell path and interval

2. **useStorageSubscriber** (`src/hooks/useStorageSubscriber.ts`)
   - Appends session to CSV on `completed` and `canceled` events
   - Handles window close: saves with status 'unknown' if timer active
   - Uses `appendSession()` from `src/lib/storage.ts`

3. **useDbusSubscriber** (`src/hooks/useDbusSubscriber.ts`)
   - Syncs timer state to GNOME panel indicator on every `tick`
   - Throttles updates to avoid redundant D-Bus calls
   - Silently fails on non-Linux platforms

4. **useWindowSubscriber** (`src/hooks/useWindowSubscriber.ts`)
   - On `started`: switches to corner mode if configured AND timer has content (focusText or prediction)
   - On `completed`/`canceled`: switches back to normal mode
   - User-triggered mode changes (Tab, Space, c keys) handled directly in Timer.tsx

All subscribers are mounted in AppProvider and run independently without knowing about each other.

### Timer State Access in React

**For reactive updates** (components that need to re-render on every tick):
```typescript
import { useTimerState } from '../hooks/useTimerState'

const { timerState, elapsed, remaining, isOvertime } = useTimerState()
```
Uses `useSyncExternalStore` internally - only components using this hook re-render on tick.

**For commands** (calling timer methods):
```typescript
import { timerMachine } from '../lib/timer-machine'

timerMachine.start(focusText, predictedSeconds, adjustmentSeconds, tags)
timerMachine.adjust(60)  // Add 1 minute
timerMachine.complete()
timerMachine.cancel()
```

**Key Insight**: Timer state includes `adjustmentSeconds` to handle +/- time adjustments (j/k keys) without resetting the start time. Elapsed time is always calculated fresh from `startTime` for accuracy.

### Storage System (`src/lib/storage.ts`)

**Session Persistence**:
- All sessions saved to CSV: `~/.local/share/pucoti/sessions.csv`
- Format: timestamp, focus_text, predicted_seconds, actual_seconds, status, tags
- Status types: 'completed', 'canceled', 'unknown'
- On window close: if timer is active, saves session with status 'unknown'

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

1. **Timer** (`src/screens/Timer.tsx`): Active timer display with j/k adjustment keys
   - Press Enter to open CommandPalette for setting intent/duration
   - Keyboard shortcuts for time adjustment (j/k, digit keys)
   - Display modes: normal, zen, small
2. **Stats** (`src/screens/Stats.tsx`): Calibration plots and session history
3. **Settings** (`src/screens/Settings.tsx`): Configure window behavior and notifications
4. **Completion** (`src/screens/Completion.tsx`): Feedback on estimation accuracy after completing a timer

**CommandPalette** (`src/components/CommandPalette.tsx`): Modal overlay for starting timers with intent and duration. Opened via Enter key from Timer screen.

## Tauri Backend

Minimal Rust backend (`src-tauri/src/lib.rs`) provides:
- Shell command execution via tauri-plugin-shell
- Filesystem access via tauri-plugin-fs
- OS notifications via tauri-plugin-notification
- Custom shell commands: `run-sh`, `run-swaymsg` (defined in tauri.conf.json's shell scope)
- Add capabilities to src-tauri/capabilities/default.json to allow the app to access the necessary APIs.

Frontend communicates via `@tauri-apps/api` and plugin imports.

**Platform Support**: The application targets Windows, macOS, and Linux and should be compatible with all three platforms. Code should be written with cross-platform compatibility in mind.

## UI Components

**Catalyst Components** (`src/components/catalyst/`): Use these when possible instead of creating custom components. Available: alert, auth-layout, avatar, badge, button, checkbox, combobox, description-list, dialog, divider, dropdown, fieldset, heading, input, link, listbox, navbar, pagination, radio, select, sidebar-layout, sidebar, stacked-layout, switch, table, text, textarea.

- Application-specific components in `src/components/`

### Plot Components & Bundle Optimization

**Lazy-loaded plots** (`src/components/plots.tsx`): Centralized exports for all Plotly-based charts with automatic code-splitting:
- Import from `../components/plots` instead of individual component files
- Components are automatically lazy-loaded with Suspense boundaries built-in
- No need to manually wrap in `React.lazy()` or `<Suspense>`
- Reduces initial bundle size by 93% (5.2 MB → 371 KB, 1.57 MB → 112 KB gzipped)
- Plotly bundle (1.1 MB) only loads when Stats or Completion screens are accessed

**Custom Plotly bundle** (`src/lib/plotly-custom.ts`):
- Uses modular imports from `plotly.js/lib/*` instead of full distribution
- Only includes trace types we use: scatter and violin
- Reduces Plotly size by ~65% compared to `plotly.js-dist-min`

**Adding new plot components**:
1. Create component in `src/components/` that imports from `../lib/plotly-custom`
2. Add lazy export to `src/components/plots.tsx` with Suspense wrapper
3. Import from `../components/plots` anywhere in the app

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

Handled by `useStorageSubscriber` hook:
- Start timer: `timerMachine.start()` creates timer state in memory, emits `started` event
- Complete/Cancel: `timerMachine.complete()`/`cancel()` emit events, subscriber appends to `sessions.csv`
- Window close: subscriber detects active timer via `timerMachine.getState()`, saves session with status 'unknown'

## Changelog Management

**The changelog is for users, not developers.**

When updating `CHANGELOG.md`:

1. **Only include user-facing changes**:
   - ✅ New features users can see and use
   - ✅ Bug fixes users would notice
   - ✅ Behavior changes that affect user experience
   - ❌ Internal refactorings
   - ❌ Code cleanups or architecture changes
   - ❌ Developer-only improvements (build process, CI, etc.)

2. **Organization**:
   - We write changelog entries for minor version only
   - Use today's date by default for the release date
   - Write in user-friendly language (avoid technical jargon)

3. **Construct the changelog from the git log**:
   Commits are usually multi-line, so read the full log entries since the last minor version release.

## Notes
- Keep this file (CLAUDE.MD) up to date. Document architecture changes, new important features, new folders.
