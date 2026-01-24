import { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { parseTime, formatTimePreview } from '../lib/time-parser'
import { Button } from '../components/catalyst/button'
import { Input } from '../components/catalyst/input'
import { Text } from '../components/catalyst/text';
import { Heading } from '../components/catalyst/heading';
import { saveActiveSession } from '../lib/storage'
import confetti from 'canvas-confetti'

export function NewFocus() {
  const { startTimer, showConfetti, clearConfetti } = useApp()
  const [focusText, setFocusText] = useState('')
  const [timeInput, setTimeInput] = useState('')
  const focusInputRef = useRef<HTMLInputElement>(null)

  const parsedSeconds = parseTime(timeInput)
  const isValid = focusText.trim() && parsedSeconds !== null && parsedSeconds > 0

  // Fire confetti on mount if we just completed a session
  useEffect(() => {
    if (showConfetti) {
      const duration = 2000
      const end = Date.now() + duration

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: ['#f59e0b', '#fbbf24', '#22c55e', '#3b82f6'],
        })
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: ['#f59e0b', '#fbbf24', '#22c55e', '#3b82f6'],
        })

        if (Date.now() < end) {
          requestAnimationFrame(frame)
        }
      }
      frame()

      const timeout = setTimeout(clearConfetti, duration)
      return () => clearTimeout(timeout)
    }
  }, [showConfetti, clearConfetti])

  // Focus the input on mount
  useEffect(() => {
    focusInputRef.current?.focus()
  }, [])

  const handleStart = async () => {
    if (!isValid || parsedSeconds === null) return

    // Save active session for recovery
    try {
      await saveActiveSession({
        startTime: new Date().toISOString(),
        focusText: focusText.trim(),
        predictedSeconds: parsedSeconds,
      })
    } catch (err) {
      console.error('Failed to save active session:', err)
    }

    startTimer(focusText.trim(), parsedSeconds)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && isValid) {
      handleStart()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <Heading level={1} className="text-3xl font-bold">New Focus Session</Heading>
          <Text>What will you accomplish?</Text>
        </div>

        <div className="space-y-6" onKeyDown={handleKeyDown}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              I'll focus on...
            </label>
            <Input
              ref={focusInputRef}
              type="text"
              value={focusText}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFocusText(e.target.value)}
              placeholder="Writing the intro section"
              className="text-lg"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              I'll be done in...
            </label>
            <Input
              type="text"
              value={timeInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTimeInput(e.target.value)}
              placeholder="25m"
              className="text-lg"
            />
            <Text className="text-sm h-5">
              {parsedSeconds !== null && parsedSeconds > 0 && (
                <span className="text-accent">{formatTimePreview(parsedSeconds)}</span>
              )}
              {timeInput && parsedSeconds === null && (
                <span className="text-red-400">Invalid format. Try "25m", "1h 30m", "45:00"</span>
              )}
            </Text>
          </div>

          <div className="pt-4">
            <Button
              color="amber"
              className="w-full py-3 text-lg"
              disabled={!isValid}
              onClick={handleStart}
            >
              Start Focus
            </Button>
            <Text className="text-center text-xs mt-2">
              or press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">Enter</kbd>
            </Text>
          </div>
        </div>
      </div>
    </div>
  )
}
