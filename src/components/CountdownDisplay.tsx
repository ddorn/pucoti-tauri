import { useEffect, useState } from 'react'
import { formatCountdown } from '../lib/format'
import { COLOR_PALETTES } from '../lib/colors'
import clsx from 'clsx'

// Visually dense non-letter symbols that resemble digits in weight but don't reveal time
const SCRAMBLE_SYMBOLS = '!@#$%&*?€¿Ø‽£408'

function randomSymbol(exclude?: string) {
  const pool = exclude ? SCRAMBLE_SYMBOLS.split('').filter(s => s !== exclude) : SCRAMBLE_SYMBOLS.split('')
  return pool[Math.floor(Math.random() * pool.length)]
}

function useScrambledDisplay(active: boolean): string {
  const [symbols, setSymbols] = useState<[string, string, string, string]>(() => [
    randomSymbol(), randomSymbol(), randomSymbol(), randomSymbol(),
  ])

  useEffect(() => {
    if (!active) return
    const interval = setInterval(() => {
      setSymbols(prev => [
        Math.random() < 1 / 600 ? randomSymbol(prev[0]) : prev[0], // tens of minutes
        Math.random() < 1 / 60  ? randomSymbol(prev[1]) : prev[1], // ones of minutes
        Math.random() < 1 / 10  ? randomSymbol(prev[2]) : prev[2], // tens of seconds
        randomSymbol(prev[3]),                                       // ones of seconds (always)
      ])
    }, 1000)
    return () => clearInterval(interval)
  }, [active])

  return `${symbols[0]}${symbols[1]}:${symbols[2]}${symbols[3]}`
}

interface CountdownDisplayProps {
  remaining: number
  autoscale?: boolean
  accentColor?: keyof typeof COLOR_PALETTES
  className?: string
  scrambled?: boolean
}

/**
 * Displays the countdown timer with consistent styling.
 *
 * When autoscale=true, uses dynamic font sizing that adapts to countdown length
 * using container query units. You may need to set a width or height with !important if 100%
 * doesn't correspond to the desired size.
 * When false, uses className for sizing.
 *
 * When scrambled=true, shows random symbols instead of the real time (for calibration training).
 */
export function CountdownDisplay({
  remaining,
  autoscale = false,
  accentColor,
  className,
  scrambled = false,
}: CountdownDisplayProps) {
  const scrambledDisplay = useScrambledDisplay(scrambled)

  const isOvertime = remaining < 0
  const countdown = scrambled ? scrambledDisplay : formatCountdown(remaining)

  const baseClasses = clsx(
    'font-timer font-bold tracking-tight leading-none',
    isOvertime ? 'text-red-500' : 'text-zinc-100',
  )

  const textShadow = isOvertime
    ? `0px max(0.03em,2px) 0px rgb(127 29 29)` // Darker red shadow for overtime
    : accentColor
    ? `0px max(0.03em,2px) 0px var(--color-accent)`
    : undefined

  let fontSize = ''
  if (autoscale) {
    const countdownLength = countdown.length
    // Dynamic sizing: scales based on viewport and countdown length
    fontSize = `min(100cqh, ${170 / (countdownLength)}cqw)`
  }

  return (
    <div className={clsx("w-full h-full flex items-center justify-center", className)} style={{ containerType: 'size' }}>
      <p
        className={baseClasses}
        style={{ fontSize, textShadow }}
      >
        {countdown}
      </p>
    </div>
  );
}
