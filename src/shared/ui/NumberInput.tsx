import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { commitBoundedInteger, parseBoundedInteger } from './numberDraft'

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'min' | 'max' | 'onChange'
> & {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}

/** Clamping on every keystroke turns "400" into 1800; clamp only when editing ends. */
export function NumberInput({
  value,
  min,
  max,
  onChange,
  onBlur,
  onKeyDown,
  ...props
}: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = (text: string) => {
    setDraft(null)
    const next = commitBoundedInteger(text, min, max, value)
    if (next !== value) onChange(next)
  }
  return (
    <input
      {...props}
      type="number"
      min={min}
      max={max}
      value={draft ?? value}
      onChange={(event) => {
        setDraft(event.target.value)
        const next = parseBoundedInteger(event.target.value, min, max)
        if (next !== undefined && next !== value) onChange(next)
      }}
      onBlur={(event) => {
        commit(event.target.value)
        onBlur?.(event)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit(event.currentTarget.value)
        onKeyDown?.(event)
      }}
    />
  )
}
