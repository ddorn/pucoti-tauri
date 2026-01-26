import { useState, useEffect } from 'react';
import { Input } from './catalyst/input'

interface ValidatedNumericInputProps {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  className?: string
}

export function ValidatedNumericInput({
  value,
  onChange,
  min,
  max,
  className = ''
}: ValidatedNumericInputProps) {
  const [localValue, setLocalValue] = useState(String(value))
    const [showError, setShowError] = useState(false)

  // Sync local value when prop changes (e.g., from reset button)
  useEffect(() => {
    setLocalValue(String(value))
    setShowError(false)
  }, [value])

  const isValid = (val: string): boolean => {
    if (val === '') return false
    const num = parseInt(val)
    return !isNaN(num) && num >= min && num <= max
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)
    setShowError(false)

    // If valid, update parent immediately
    if (isValid(newValue)) {
        onChange(parseInt(newValue))
    }
  }

    const handleBlur = () => {
    // If invalid, show error but don't reset
    if (!isValid(localValue)) {
      setShowError(true)
    }
  }

  return (
    <Input
      type="number"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
      invalid={showError}
      min={min}
      max={max}
    />
  )
}
