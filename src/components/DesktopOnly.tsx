import type { ReactNode } from 'react'
import { isTauri } from '../lib/platform'

interface DesktopOnlyProps {
  children: ReactNode
}

const INSTALL_URL = 'https://github.com/ddorn/pucoti-tauri#installation'

/** Badge shown next to headings for desktop-only sections. Returns null on desktop. */
export function DesktopOnlyBadge() {
  if (isTauri) return null
  return (
    <a
      href={INSTALL_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-500 ring-1 ring-zinc-700 hover:bg-zinc-700 hover:text-zinc-300 transition-colors cursor-pointer"
    >
      Desktop only
    </a>
  )
}

/**
 * Grays out desktop-only content on web and disables interaction.
 * Use DesktopOnlyBadge separately next to the section heading.
 */
export function DesktopOnly({ children }: DesktopOnlyProps) {
  if (isTauri) return <>{children}</>
  return (
    <div className="opacity-40 pointer-events-none select-none">
      {children}
    </div>
  )
}
