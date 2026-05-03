/**
 * Platform abstraction layer.
 *
 * Build-time flag: VITE_PLATFORM=tauri for desktop, unset (or "web") for web.
 *
 * Use `isTauri` for conditional UI rendering.
 * Use `platform.*` for all platform-dependent operations.
 *
 * The chosen implementation is loaded via dynamic import, so the unused
 * implementation (and its transitive Tauri/web-only dependencies) is never
 * pulled into the bundle.
 */
import type { Platform } from './types'

export type { Platform }

export const isTauri: boolean = import.meta.env.VITE_PLATFORM === 'tauri'

export const platform: Platform = isTauri
  ? (await import('./tauri')).tauriPlatform
  : (await import('./web')).webPlatform
