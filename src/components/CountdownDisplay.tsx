import { formatCountdown } from '../lib/format'
import { COLOR_PALETTES } from '../lib/colors'
import clsx from 'clsx'

interface CountdownDisplayProps {
  remaining: number
  autoscale?: boolean
  accentColor?: keyof typeof COLOR_PALETTES
  className?: string
}

/**
 * Displays the countdown timer with consistent styling.
 *
 * When autoscale=true, uses dynamic font sizing that adapts to countdown length
 * using container query units. You may need to set a width or height with !important if 100%
 * doesn't correspond to the desired size.
 * When false, uses className for sizing.
 */
export function CountdownDisplay({
  remaining,
  autoscale = false,
  accentColor,
  className
}: CountdownDisplayProps) {
  const isOvertime = remaining < 0
  const countdown = formatCountdown(remaining)

  const baseClasses = clsx(
    'font-timer font-bold tracking-tight leading-none',
    isOvertime ? 'text-red-500' : 'text-zinc-100',
  )

  const textShadow = isOvertime || !accentColor
    ? undefined
    : `0px max(0.03em,2px) 0px ${COLOR_PALETTES[accentColor].base}`

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