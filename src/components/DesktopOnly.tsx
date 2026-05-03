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
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent ring-1 ring-accent/30 hover:bg-accent/20 hover:text-accent/80 transition-colors cursor-pointer text-shadow-none"
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
