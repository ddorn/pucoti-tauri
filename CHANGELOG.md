# Changelog

## [1.1.0] - 2026-01-28

### Added

- **GNOME panel indicator**: New panel extension shows timer status in the GNOME top bar. The extension is automatically bundled in .deb/.rpm packages and can be enabled from Settings. When combined with the new "minimize on timer start" option, you can run Pucoti entirely from the panel.

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
