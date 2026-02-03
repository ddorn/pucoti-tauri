interface RadioOption {
  id: string
  name: string
  description: string
}

interface RadioGroupProps {
  name: string
  options: RadioOption[]
  value: string
  onChange: (value: string) => void
}

export function RadioGroup({ name, options, value, onChange }: RadioGroupProps) {
  return (
    <fieldset className="-space-y-px rounded-md bg-white/5">
      {options.map((option) => (
        <label
          key={option.id}
          className="group relative flex cursor-pointer border border-white/10 p-4 first:rounded-t-md last:rounded-b-md focus-within:outline-hidden has-[:checked]:z-10 has-[:checked]:border-accent/50 has-[:checked]:bg-accent/5"
        >
          <input
            type="radio"
            name={name}
            value={option.id}
            checked={value === option.id}
            onChange={() => onChange(option.id)}
            className="relative mt-0.5 size-4 shrink-0 appearance-none rounded-full border border-zinc-400 bg-zinc-900 before:absolute before:inset-1 before:rounded-full before:bg-white not-checked:before:hidden checked:border-accent checked:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:border-white/20"
          />
          <span className="ml-3 flex flex-col">
            <span className="block text-base font-medium text-zinc-100 group-has-checked:text-accent">
              {option.name}
            </span>
            <span className="block text-base text-zinc-400 group-has-checked:text-accent/80">
              {option.description}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}
