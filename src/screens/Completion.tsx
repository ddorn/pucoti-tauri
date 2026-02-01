import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useSettings } from '../context/SettingsContext'
import { loadSessions, type Session } from '../lib/storage'
import { EstimationHistogram } from '../components/EstimationHistogram'
import { getCompletionRemark } from '../lib/completion-remarks'
import { formatDuration } from '../lib/format'
import { COLOR_PALETTES, getRandomAccentColor, type AccentColor } from '../lib/colors';
import { Text } from '../components/catalyst/text'
import confetti from 'canvas-confetti'

// Confetti functions
function startPerfectConfetti() {
  // Fire stars once
  const starDefaults = {
    spread: 360,
    ticks: 50,
    gravity: 0,
    decay: 0.94,
    startVelocity: 30,
    colors: ['FFE400', 'FFBD00', 'E89400', 'FFCA6C', 'FDFFB8'],
  }

  function shootStars() {
    confetti({
      ...starDefaults,
      particleCount: 40,
      scalar: 1.2,
      shapes: ['star'],
    })

    confetti({
      ...starDefaults,
      particleCount: 10,
      scalar: 0.75,
      shapes: ['circle'],
    })
  }

  // Initial star burst (once)
  setTimeout(shootStars, 1000)
  setTimeout(shootStars, 1100)
  setTimeout(shootStars, 1200)

  // Continuous falling confetti - never stops
  const fireworksDefaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'] // Rainbow

  const randomInRange = (min: number, max: number) => {
    return Math.random() * (max - min) + min
  }

  const interval = setInterval(() => {
    const particleCount = 50
    // since particles fall down, start a bit higher than random
    confetti({ ...fireworksDefaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }, colors })
    confetti({ ...fireworksDefaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }, colors })
  }, 250)

  return () => clearInterval(interval)
}

function startWithinTenConfetti() {
  const duration = 15 * 1000
  const animationEnd = Date.now() + duration
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'] // Rainbow

  const randomInRange = (min: number, max: number) => {
    return Math.random() * (max - min) + min
  }

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now()

    if (timeLeft <= 0) {
      return clearInterval(interval)
    }

    const particleCount = 50 * (timeLeft / duration)
    // since particles fall down, start a bit higher than random
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }, colors })
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }, colors })
  }, 250)

  return () => clearInterval(interval)
}

function startSimpleConfetti(accentColor: AccentColor) {
  const duration = 1000
  const end = Date.now() + duration
  const accentPalette = COLOR_PALETTES[accentColor]
  const randomColor1 = getRandomAccentColor(accentColor);
  // Ensure second color is different from both accent and first random color
  let randomColor2 = getRandomAccentColor(accentColor);
  while (randomColor2 === randomColor1) {
    randomColor2 = getRandomAccentColor(accentColor);
  }
  const colors = [accentPalette.base, COLOR_PALETTES[randomColor1].base, COLOR_PALETTES[randomColor2].base]

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors,
    })
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors,
    })

    if (Date.now() < end) {
      requestAnimationFrame(frame)
    }
  }

  frame()
}

export function Completion() {
  const { completionData, setScreen, clearCompletionData } = useApp()
  const { settings } = useSettings()
  const [sessions, setSessions] = useState<Session[]>([])

  // Extract data (with defaults to handle null case)
  const { predictedSeconds = null, actualSeconds = 0, tags = [], focusText = '' } = completionData || {}
  // It's timebox mode if predictedSeconds is null or has the timebox tag
  const isTimebox = predictedSeconds === null || tags.includes('mode:timebox')

  // Calculate error percentage (positive = took longer, negative = finished faster)
  // Only calculate if we have a prediction (not timebox mode)
  const errorPercent = predictedSeconds !== null && predictedSeconds > 0
    ? ((actualSeconds - predictedSeconds) / predictedSeconds) * 100
    : 0
  const absError = Math.abs(errorPercent)
  const isWithinOne = !isTimebox && absError <= 1
  const isWithinTen = !isTimebox && absError <= 10

  // Load sessions on mount
  useEffect(() => {
    loadSessions().then(setSessions).catch(console.error)
  }, [])

  // Fire confetti on mount
  useEffect(() => {
    if (isTimebox) {
      // Timebox gets simple confetti
      startSimpleConfetti(settings.accentColor)
      return
    }
    if (isWithinOne) {
      // Perfect confetti - never stops
      return startPerfectConfetti()
    } else if (isWithinTen) {
      // Continuous falling confetti for within 10%
      return startWithinTenConfetti()
    } else {
      // Simple side-firing confetti for other cases
      startSimpleConfetti(settings.accentColor)
    }
  }, [isTimebox, isWithinOne, isWithinTen, settings.accentColor])

  // Listen for Enter key to continue
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        clearCompletionData()
        setScreen('timer')
        // Note: displayMode is already set to 'normal' in completeTimer
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [setScreen, clearCompletionData])

  // Handle null completion data after all hooks have been called
  if (!completionData) {
    return null
  }

  if (isTimebox) {
    // Simple timebox completion
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8">
        <div className="w-full max-w-2xl text-center space-y-6">
          <h1 className="text-5xl font-bold text-zinc-100">
            Well done!
          </h1>
          <p className="text-2xl text-zinc-400">
            You focused for {formatDuration(actualSeconds)}
          </p>
          <Text className="text-center text-xs mt-12 text-zinc-400">
            Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">Enter</kbd> to continue
          </Text>
        </div>
      </div>
    )
  }

  // Predict mode - show full feedback
  const remark = getCompletionRemark(errorPercent)

  // Determine color based on error
  const errorColor = absError <= 10
    ? COLOR_PALETTES[settings.accentColor].base // Great
    : errorPercent > 0
    ? '#ef4444' // Took longer (red)
    : '#3b82f6' // Took less time (blue)

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8 overflow-y-auto">
      <div className="w-full max-w-4xl space-y-4">
        {/* Headline */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl md:text-5xl font-bold text-zinc-100">
            You took{' '}
            <span style={{ color: errorColor }}>
              {errorPercent === 0
                ? 'exactly as long as predicted'
                : errorPercent > 0
                  ? `${absError.toFixed(0)}% longer`
                  : `${absError.toFixed(0)}% less time`}
            </span>
            {errorPercent !== 0 && ' than predicted'}
            {focusText && (
              <>
                {' '}to{' '}
                <span className="text-accent">{focusText}</span>
              </>
            )}
          </h1>
          <p className="text-2xl md:text-3xl text-zinc-400">
            {remark}
          </p>
        </div>

        {/* Details */}
        <div className="text-center space-y-1 text-zinc-500 text-lg">
          <span className="text-zinc-400">{formatDuration(predictedSeconds ?? 0)}</span> predicted
          {' → '}
          <span className="text-zinc-400">{formatDuration(actualSeconds)}</span> actual
        </div>

        {/* Histogram */}
        {sessions.length > 0 && (
          <EstimationHistogram
            sessions={sessions.slice(-500)}
            currentError={errorPercent}
            accentColor={settings.accentColor}
          />
        )}

        {/* Continue prompt */}
        <Text className="text-center text-xs pt-2 text-zinc-400">
          Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">Enter</kbd> to continue
        </Text>
      </div>
    </div>
  )
}
