type ButtonGroupOption<T extends string> = {
  value: T
  label: string
}

type ButtonGroupProps<T extends string> = {
  options: ButtonGroupOption<T>[]
  value: T
  onChange: (value: T) => void
}

export function ButtonGroup<T extends string>({ options, value, onChange }: ButtonGroupProps<T>) {
  return (
    <span className="isolate inline-flex rounded-md shadow-xs">
      {options.map((opt, i) => {
        const isFirst = i === 0
        const isLast = i === options.length - 1
        const isActive = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              'relative inline-flex items-center px-3 py-1 text-sm font-medium focus:z-10 focus:outline-none transition-colors',
              isFirst ? 'rounded-l-md' : '-ml-px',
              isLast ? 'rounded-r-md' : '',
              isActive
                ? 'bg-zinc-700 text-white inset-ring-1 inset-ring-zinc-600 z-10'
                : 'bg-zinc-900 text-zinc-400 inset-ring-1 inset-ring-zinc-700 hover:bg-zinc-800 hover:text-zinc-200',
            ].join(' ')}
          >
            {opt.label}
          </button>
        )
      })}
    </span>
  )
}
