# Changelog

## [1.3.0] - 2026-02-12

### Added

- **Redesign the main timer/prediction flow**: The app now directly opens with a running timer. Press Enter to set your intent and prediction directly. This makes it faster to start timers and set prediction, uses the same inteface for predictions and time boxes, but embodies less intentionality. This will be improved in a future release.

- **Automatic update checking**: The app now shows when new releases are available on GitHub. You can disable automatic checks or manually check for updates from the Settings screen.

- **Shell command integration**: Two new hooks let you integrate Pucoti with external tools:
  - **Prefill hook**: Press Shift+Enter to populate the timer with data from an external command (e.g., pull your current intention from intend.do)
  - **Completion hook**: Run a shell command automatically when a timer completes (e.g., log to external tracking systems)

- **Confirmation for timers without predictions**: When you try to start a timer without a duration, you'll now see a warning prompting you to add a time estimate or press Enter again to confirm. This prevents accidentally starting timebox mode when you meant to set a prediction.

- **CLI flags**: You can now run `pucoti --version` (or `-v`) to print version information and `pucoti --help` (or `-h`) to show usage information.


### Fixed

- **Confetti crashes**: Fixed occasional app crashes or freezes when confetti is displayed on the completion screen by ensuring proper cleanup of all canvas elements and animation loops. Hopefully. Please report any crashes if there are still some.

- **Bell overlap**: The overtime bell now properly stops when you start a new timer, preventing the previous timer's repeating bell from continuing.

- **Text display issues**: Fixed multiple text rendering problems:
  - Intent text descenders (like 'g', 'y', 'p') no longer get clipped
  - Intent text now properly scales in small mode using viewport width
  - Intent text no longer truncates on large screens (can use up to 90% of viewport width)
  - Completion screen no longer shows "0% longer" when the error rounds to zero

- **Platform detection**: GNOME-specific UI elements now properly hide when running on other desktop environments (uses XDG_CURRENT_DESKTOP for reliable detection).

- **Other fixes**: Histogram range always includes your current prediction, adjustment curve now extends down to -100%, and various spacing issues in the navbar have been resolved.

### Changed

- **Redesigned Settings screen**: The Settings screen now features improved visual hierarchy with colorful headings, better grouping of related options, and larger font sizes throughout the app for better readability.

- **Visual polish**: Timer now has an accent-colored outline.

- **Fixed navbar**: The navigation bar is now fixed to the top of the window with improved layout and spacing.

- **93% smaller bundle**: Optimized the app bundle from 5.2 MB to 371 KB (1.57 MB to 112 KB gzipped) by lazy-loading chart components and using a minimal Plotly build. Charts only load when you visit the Stats or Completion screens.

- **Timers without intent**: You can now save and complete timers that have only a duration (no intent text). These sessions still appear in your history and show a completion screen.

## [1.2.0] - 2026-01-29

### Added

- **Completion screen with estimation accuracy feedback**: After completing a predict-mode timer, you now see a visualization showing your estimation accuracy. Features include:
  - Half-violin plot displaying your historical estimation error distribution
  - Confetti celebration (try to get within 1% of your prediction!)
  - Contextual playful remarks based on your accuracy

- **Random accent color option**: New "random" option in the color picker automatically changes your accent color to a random value after each completed timer. The option appears as a gradient shuffle icon in the color picker.

- **Flexible corner margins**: Corner margin settings now support unrestricted numeric values, including negative numbers, giving you complete control over small mode window positioning. Particularly useful when we fail badly to detect screen size/scaling.

### Fixed

- **Session count accuracy**: Stats now correctly distinguish between total completed sessions (all modes) and prediction sessions (predict mode only). Calibration statistics and plots now accurately show only prediction-based data.

- **GNOME extension detection**: Added filesystem permissions to properly detect GNOME panel extension status without "forbidden path" errors.

## [1.1.0] - 2026-01-28

### Added

- **GNOME panel indicator**: New panel extension shows timer status in the GNOME top bar. The extension is automatically bundled in .deb/.rpm packages and can be enabled from Settings. When combined with the new "minimize on timer start" option, you can rely solely on the panel while the timer is running.

- **Corner position persistence**: Your preferred corner for small mode now persists between app runs.

- **Unified "on timer start" setting**: Replaced separate settings with a single choice:
  - *Nothing*: No automatic window changes
  - *Corner*: Move to corner (small mode)
  - *Minimize*: Minimize window (useful with GNOME panel indicator)

- **Timer start percentage**: Start the timer at a percentage of your prediction. Set to 80% to get a reminder 20% before your predicted time (e.g. predict 20 min → timer starts at 16:00, rings at 0:00, actual deadline at -4:00).

- **Default duration setting**: Configure how the duration field is pre-filled when starting a new timer:
  - *None*: Start with empty duration (new default)
  - *Last*: Use your last timer's duration
  - *Fixed*: Always use a specific duration you set

- **Contextual Enter key hints**: The NewFocus screen now shows context-aware hints:
  - "Enter to edit duration" when editing intention
  - "Enter to start" when editing duration
  - "Enter to edit intention" when no input is focused

  Pressing Enter with no input focused now focuses the intention input, enabling full keyboard-only navigation.

### Fixed

- **Expected window decorations**: Title bar with buttons now displays correctly on macOS and Windows. Sway's dual decoration system is handled properly (Sway renders decorations, not Tauri).

- **Bell sound in release builds**: The bell now plays correctly in every environment (hopefully). Previously, path resolution issues caused silent failures.

- **Tabs visible after timer completion**: Navigation tabs now always appear after completing a timer in small/zen mode, allowing you to switch to settings or stats.

- **Sway fullscreen to corner transition**: Now properly exits fullscreen before moving to corner mode.

### Changed

- **Bundled fonts**: Fonts are now included in the app instead of fetched from Google Fonts. Works offline and improves privacy.

- **Binary renamed**: The executable is now called `pucoti` instead of `app`.

- **Platform-agnostic window management**: Refactored window code to use a strategy pattern, making it easier to add support for other window managers (Hyprland, i3, etc.) in the future.

## [1.0.0] - 2026-01-26

Initial release.
