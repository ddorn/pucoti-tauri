// All Tailwind accent colors (excluding grays)
export type AccentColor =
  | 'red'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'lime'
  | 'green'
  | 'emerald'
  | 'teal'
  | 'cyan'
  | 'sky'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'purple'
  | 'fuchsia'
  | 'pink'
  | 'rose'

export const COLOR_PALETTES: Record<AccentColor, { base: string; hover: string; muted: string }> = {
  red: {
    base: '#ef4444',      // red-500
    hover: '#f87171',     // red-400
    muted: '#b91c1c',     // red-700
  },
  orange: {
    base: '#f97316',      // orange-500
    hover: '#fb923c',     // orange-400
    muted: '#c2410c',     // orange-700
  },
  amber: {
    base: '#f59e0b',      // amber-500
    hover: '#fbbf24',     // amber-400
    muted: '#b45309',     // amber-700
  },
  yellow: {
    base: '#eab308',      // yellow-500
    hover: '#facc15',     // yellow-400
    muted: '#a16207',     // yellow-700
  },
  lime: {
    base: '#84cc16',      // lime-500
    hover: '#a3e635',     // lime-400
    muted: '#65a30d',     // lime-700
  },
  green: {
    base: '#22c55e',      // green-500
    hover: '#4ade80',     // green-400
    muted: '#15803d',     // green-700
  },
  emerald: {
    base: '#10b981',      // emerald-500
    hover: '#34d399',     // emerald-400
    muted: '#047857',     // emerald-700
  },
  teal: {
    base: '#14b8a6',      // teal-500
    hover: '#2dd4bf',     // teal-400
    muted: '#0f766e',     // teal-700
  },
  cyan: {
    base: '#06b6d4',      // cyan-500
    hover: '#22d3ee',     // cyan-400
    muted: '#0e7490',     // cyan-700
  },
  sky: {
    base: '#0ea5e9',      // sky-500
    hover: '#38bdf8',     // sky-400
    muted: '#0369a1',     // sky-700
  },
  blue: {
    base: '#3b82f6',      // blue-500
    hover: '#60a5fa',     // blue-400
    muted: '#1d4ed8',     // blue-700
  },
  indigo: {
    base: '#6366f1',      // indigo-500
    hover: '#818cf8',     // indigo-400
    muted: '#4338ca',     // indigo-700
  },
  violet: {
    base: '#8b5cf6',      // violet-500
    hover: '#a78bfa',     // violet-400
    muted: '#6d28d9',     // violet-700
  },
  purple: {
    base: '#a855f7',      // purple-500
    hover: '#c084fc',     // purple-400
    muted: '#7e22ce',     // purple-700
  },
  fuchsia: {
    base: '#d946ef',      // fuchsia-500
    hover: '#e879f9',     // fuchsia-400
    muted: '#a21caf',     // fuchsia-700
  },
  pink: {
    base: '#ec4899',      // pink-500
    hover: '#f472b6',     // pink-400
    muted: '#be185d',     // pink-700
  },
  rose: {
    base: '#f43f5e',      // rose-500
    hover: '#fb7185',     // rose-400
    muted: '#be123c',     // rose-700
  },
}

export function applyAccentColor(color: AccentColor) {
  const palette = COLOR_PALETTES[color]
  document.documentElement.style.setProperty('--color-accent', palette.base)
  document.documentElement.style.setProperty('--color-accent-hover', palette.hover)
  document.documentElement.style.setProperty('--color-accent-muted', palette.muted)
}

/**
 * Get a random accent color, optionally excluding the current color
 */
export function getRandomAccentColor(excludeColor?: AccentColor): AccentColor {
  const allColors: AccentColor[] = [
    'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
    'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'
  ]

  const availableColors = excludeColor
    ? allColors.filter(c => c !== excludeColor)
    : allColors

  const randomIndex = Math.floor(Math.random() * availableColors.length)
  return availableColors[randomIndex]
}
