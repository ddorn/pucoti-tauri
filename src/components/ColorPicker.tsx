import clsx from 'clsx'
import type { AccentColor } from '../lib/colors'
import { COLOR_PALETTES } from '../lib/colors'

interface ColorPickerProps {
  value: AccentColor
  onChange: (color: AccentColor) => void
}

const COLOR_ORDER: AccentColor[] = [
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
]

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="grid grid-cols-6 sm:grid-cols-9 gap-3">
      {COLOR_ORDER.map((color) => {
        const palette = COLOR_PALETTES[color]
        const isSelected = value === color

        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={clsx(
              'relative w-8 h-8 rounded-full transition-all',
              'hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface focus:ring-accent',
              isSelected && 'ring-2 ring-offset-2 ring-offset-surface ring-accent scale-110'
            )}
            style={{
              backgroundColor: palette.base,
            }}
            title={color.charAt(0).toUpperCase() + color.slice(1)}
            aria-label={`Select ${color} color`}
            aria-pressed={isSelected}
          >
            {isSelected && (
              <svg
                className="absolute inset-0 m-auto w-5 h-5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        )
      })}
    </div>
  )
}
