import clsx from 'clsx'

interface ModeTabButtonProps {
  mode: string
  currentMode: string
  onClick: () => void
  title: string
  emoji: string
  label: string
  activeColor: 'amber' | 'emerald' | 'purple'
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
  const colorClasses = {
    amber: 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50',
    emerald: 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50',
    purple: 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/50',
  }

  return (
    <button
      onClick={onClick}
      title={title}
      className={clsx(
        "h-8 rounded-full flex items-center justify-center transition-all text-sm",
        isActive
          ? `${colorClasses[activeColor]} px-3 gap-1.5`
          : "w-8 text-zinc-600/70 hover:text-zinc-500 hover:bg-zinc-800"
      )}
    >
      <span>{emoji}</span>
      {isActive && <span className="text-xs font-medium">{label}</span>}
    </button>
  )
}
