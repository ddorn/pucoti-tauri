import clsx from 'clsx'
import type { AccentColor } from '../lib/colors';

type SemanticColor = 'emerald' | 'purple';
type ModeTabColor = AccentColor | SemanticColor

interface ModeTabButtonProps {
  mode: string
  currentMode: string
  onClick: () => void
  title: string
  emoji: string
  label: string
  activeColor: ModeTabColor;
}

const COLOR_CLASSES: Record<ModeTabColor, string> = {
  red: 'bg-red-500/20 text-red-400 ring-1 ring-red-500/50',
  orange: 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/50',
  amber: 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50',
  yellow: 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/50',
  lime: 'bg-lime-500/20 text-lime-400 ring-1 ring-lime-500/50',
  green: 'bg-green-500/20 text-green-400 ring-1 ring-green-500/50',
  emerald: 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50',
  teal: 'bg-teal-500/20 text-teal-400 ring-1 ring-teal-500/50',
  cyan: 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/50',
  sky: 'bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/50',
  blue: 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50',
  indigo: 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/50',
  violet: 'bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/50',
  purple: 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/50',
  fuchsia: 'bg-fuchsia-500/20 text-fuchsia-400 ring-1 ring-fuchsia-500/50',
  pink: 'bg-pink-500/20 text-pink-400 ring-1 ring-pink-500/50',
  rose: 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/50',
}

export function ModeTabButton({
  mode,
  currentMode,
  onClick,
  title,
  emoji,
  label,
  activeColor,
}: ModeTabButtonProps) {
  const isActive = mode === currentMode

  return (
    <button
      onClick={onClick}
      title={title}
      className={clsx(
        "h-8 px-3 rounded-full flex items-center justify-center gap-1.5 transition-all",
        isActive
          ? COLOR_CLASSES[activeColor]
          : "text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800"
      )}
    >
      <span>{emoji}</span>
      <span className="font-medium">{label}</span>
    </button>
  )
}
