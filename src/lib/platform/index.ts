/**
 * Platform abstraction layer.
 *
 * Build-time flag: VITE_PLATFORM=tauri for desktop, unset (or "web") for web.
 *
 * Use `isTauri` for conditional UI rendering.
 * Use `platform.*` for all platform-dependent operations.
 *
 * Tauri SDK packages are only imported (and bundled) when VITE_PLATFORM=tauri.
 * When building for web, the tauri branch is unreachable dead code that Vite
 * can eliminate, keeping the web bundle free of Tauri SDK code.
 */
import type { Platform } from './types'
import { tauriPlatform } from './tauri'
import { webPlatform } from './web'

export type { Platform }

// Compile-time constant — dead-code elimination removes the unused branch.
export const isTauri: boolean = import.meta.env.VITE_PLATFORM === 'tauri'

export const platform: Platform = (import.meta.env.VITE_PLATFORM === 'tauri')
  ? tauriPlatform
  : webPlatform
