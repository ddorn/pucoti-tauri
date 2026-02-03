import clsx from 'clsx'
import { RadioGroup } from '@headlessui/react';
import { IconArrowsShuffle } from '@tabler/icons-react'
import type { AccentColor } from '../lib/colors'
import { COLOR_PALETTES } from '../lib/colors'

interface ColorPickerProps {
  value: AccentColor
  onChange: (color: AccentColor) => void
  randomEnabled?: boolean
  onRandomSelect?: () => void;
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

export function ColorPicker({ value, onChange, randomEnabled = false, onRandomSelect }: ColorPickerProps) {
  const radioValue = randomEnabled ? 'random' : value

  return (
    <RadioGroup
      value={radioValue}
      onChange={(selectedValue) => {
        if (selectedValue === 'random') {
          onRandomSelect?.();
        } else {
          onChange(selectedValue as AccentColor);
        }
      }}
      className="grid grid-cols-6 sm:grid-cols-9 gap-3"
    >
      {/* Random color radio */}
      {onRandomSelect && (
        <RadioGroup.Option value="random" onClick={onRandomSelect}>
          {({ checked }) => (
            <div className="relative w-8 h-8">
              <div
                className={clsx(
                  'relative w-8 h-8 rounded-full transition-all cursor-pointer',
                  'hover:scale-110 focus:outline-none',
                  checked && 'ring-2 ring-offset-2 ring-offset-surface ring-accent scale-110',
                  'bg-gradient-to-br from-red-500 via-blue-500 to-purple-500'
                )}
                title="Random color on completion"
              >
                <IconArrowsShuffle
                  className="absolute inset-0 m-auto w-5 h-5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                  strokeWidth={2.5}
                />
              </div>
            </div>
          )}
        </RadioGroup.Option>
      )}

      {COLOR_ORDER.map((color) => {
        const palette = COLOR_PALETTES[color]

        return (
          <RadioGroup.Option key={color} value={color}>
            {({ checked }) => (
              <div className="relative w-8 h-8">
                <div
                  className={clsx(
                    'relative w-8 h-8 rounded-full transition-all cursor-pointer',
                    'hover:scale-110 focus:outline-none',
                    checked && 'ring-2 ring-offset-2 ring-offset-surface ring-accent scale-110'
                  )}
                  style={{
                    backgroundColor: palette.base,
                  }}
                  title={color.charAt(0).toUpperCase() + color.slice(1)}
                >
                  {checked && (
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
                </div>
              </div>
            )}
          </RadioGroup.Option>
        )
      })}
    </RadioGroup>
  )
}
