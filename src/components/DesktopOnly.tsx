import type { ReactNode } from 'react'
import { isTauri } from '../lib/platform'

interface DesktopOnlyProps {
  children: ReactNode
}

/**
 * Wrapper that grays out desktop-only settings sections on web.
 * On Tauri, renders children normally.
 * On web, renders children with reduced opacity and a "Desktop only" badge.
 */
export function DesktopOnly({ children }: DesktopOnlyProps) {
  if (isTauri) {
    return <>{children}</>
  }

  return (
    <div className="relative">
      <div className="opacity-50 pointer-events-none select-none">
        {children}
      </div>
      <div className="absolute top-0 right-0">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-700 text-zinc-300 ring-1 ring-zinc-600">
          Desktop only
        </span>
      </div>
    </div>
  )
}
