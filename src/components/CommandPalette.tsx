import { useState, useEffect, useRef, useMemo } from 'react'
import { parseCommand, type ParsedCommand } from '../lib/command-parser'
import { formatDuration } from '../lib/format'
import { Kbd } from './Kbd'

interface CommandPaletteProps {
  onSubmit: (parsed: ParsedCommand) => void
  onClose: () => void
}

export function CommandPalette({ onSubmit, onClose }: CommandPaletteProps) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Parse command in real-time
  const parsed = useMemo(() => parseCommand(input), [input])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Only submit if there's meaningful input
      if (parsed.intent || parsed.seconds !== null) {
        onSubmit(parsed)
      } else {
        onClose()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => {
        // Close if clicking backdrop
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="w-full max-w-2xl px-4">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Set intent and predict duration…"
          className="w-full bg-zinc-900 border-2 border-zinc-700 focus:border-accent rounded-lg
                     text-3xl md:text-4xl text-zinc-100 placeholder-zinc-600
                     px-6 py-4 outline-none transition-colors"
          autoComplete="off"
          spellCheck={false}
        />

        {/* Show parsed result */}
        {input && (
          <div className="mt-4 px-6 py-3 bg-zinc-800/50 rounded-lg text-center">
            {parsed.intent && parsed.seconds !== null && (
              <p className="text-zinc-300 text-lg">
                you want to: <span className="text-accent font-medium">{parsed.intent}</span>
                <span className="mx-3 text-zinc-600">·</span>
                80% likely to be done in: <span className="text-accent font-medium">{formatDuration(parsed.seconds)}</span>
              </p>
            )}
            {parsed.intent && parsed.seconds === null && (
              <p className="text-zinc-300 text-lg">
                you want to: <span className="text-accent font-medium">{parsed.intent}</span>
                <span className="mx-3 text-zinc-600">·</span>
                <span className="text-zinc-500">No duration (timebox mode)</span>
              </p>
            )}
            {!parsed.intent && parsed.seconds !== null && (
              <p className="text-zinc-300 text-lg">
                <span className="text-zinc-500">No intent</span>
                <span className="mx-3 text-zinc-600">·</span>
                80% likely to be done in: <span className="text-accent font-medium">{formatDuration(parsed.seconds)}</span>
              </p>
            )}
          </div>
        )}

        <div className="text-center text-zinc-500 text-sm mt-3">
          <p>Type an intent, duration, or both (e.g., "thank my friend 12m")</p>
          <p className="mt-1">
            <Kbd>Enter</Kbd> to confirm
            <span className="mx-2">·</span>
            <Kbd>Esc</Kbd> to cancel
          </p>
        </div>
      </div>
    </div>
  )
}
