import clsx from 'clsx'

interface KbdProps {
  children: React.ReactNode
  className?: string
}

export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={clsx('px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono', className)}
    >
      {children}
    </kbd>
  )
}
