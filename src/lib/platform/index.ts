/**
 * Platform abstraction layer.
 *
 * Build-time flag: VITE_PLATFORM=tauri for desktop, unset (or "web") for web.
 *
 * Use `isTauri` for conditional UI rendering.
 * Use `platform.*` for all platform-dependent operations.
 *
 * Both implementations are imported statically. `import.meta.env.VITE_PLATFORM` is
 * replaced by a literal at build time, so the choice below is a constant and the
 * bundler drops the unused implementation along with its Tauri/web-only
 * dependencies.
 *
 * This must stay a static choice, never a top-level `await import()`: the Tauri
 * implementation imports modules that import `platform` back (shell-hooks, and
 * anything the bundler puts in the same chunk as this file). A module awaiting a
 * dynamic import that depends on it never finishes evaluating, so the app would
 * hang on a blank window without any error.
 */
import type { Platform } from './types'
import { tauriPlatform } from './tauri'
import { webPlatform } from './web'

export type { Platform }

export const isTauri: boolean = import.meta.env.VITE_PLATFORM === 'tauri'

export const platform: Platform = isTauri ? tauriPlatform : webPlatform
