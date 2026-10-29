import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}
/** Select-only combobox. DOM focus stays on the trigger while the popup is open. */
export function Select({
  value,
  options,
  onChange,
  label,
  id,
  disabled = false,
}: {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  label: string
  id?: string
  disabled?: boolean
}) {
  const generated = useId(),
    popupId = `${generated}-list`
  const button = useRef<HTMLButtonElement>(null),
    list = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0)
  const [box, setBox] = useState({ left: 0, top: 0, width: 0, maxHeight: 240 })
  const search = useRef({ text: '', at: 0 })
  const blocked = () => disabled || !!button.current?.matches(':disabled')
  const first = () =>
    Math.max(
      0,
      options.findIndex((o) => !o.disabled),
    )
  const selected = options.findIndex((o) => o.value === value)
  const begin = () => {
    if (blocked() || !options.some((o) => !o.disabled)) return
    setActive(selected >= 0 && !options[selected].disabled ? selected : first())
    search.current = { text: '', at: 0 }
    setOpen(true)
  }
  const commit = (index: number) => {
    if (blocked() || !options[index] || options[index].disabled) return
    if (options[index].value !== value) onChange(options[index].value)
    setOpen(false)
  }
  useLayoutEffect(() => {
    if (!open) return
    const position = () => {
      const r = button.current!.getBoundingClientRect(),
        h = window.innerHeight
      const below = h - r.bottom - 12,
        above = r.top - 12
      const maxHeight = Math.max(60, Math.min(300, Math.max(below, above)))
      const width = Math.min(Math.max(r.width, 220), window.innerWidth - 16)
      const desired = Math.min(300, options.length * 44 + 12)
      const down = below >= desired || below >= above
      const height = Math.min(desired, down ? below : above, maxHeight)
      setBox({
        left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
        top: down ? r.bottom + 5 : Math.max(8, r.top - height - 5),
        width,
        maxHeight: Math.max(60, height),
      })
    }
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [open, options.length])
  useEffect(() => {
    if (!open) return
    list.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [open, active])
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (
        !button.current?.contains(event.target as Node) &&
        !list.current?.contains(event.target as Node)
      )
        setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  useEffect(() => {
    if (!open) return
    const closeIfDisabled = () => {
      if (disabled || button.current?.matches(':disabled')) setOpen(false)
    }
    closeIfDisabled()
    const fieldset = button.current?.closest('fieldset')
    if (!fieldset) return
    const observer = new MutationObserver(closeIfDisabled)
    observer.observe(fieldset, {
      attributes: true,
      attributeFilter: ['disabled'],
    })
    return () => observer.disconnect()
  }, [disabled, open])
  const move = (delta: number) => {
    const target = Math.max(0, Math.min(options.length - 1, active + delta))
    const enabled = options.flatMap((o, i) => (o.disabled ? [] : [i]))
    const next =
      delta > 0
        ? (enabled.find((i) => i >= target) ?? enabled.at(-1))
        : ([...enabled].reverse().find((i) => i <= target) ?? enabled[0])
    if (next !== undefined) setActive(next)
  }
  const key = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (
      !options.some((o) => !o.disabled) ||
      blocked() ||
      e.nativeEvent.isComposing ||
      e.ctrlKey ||
      e.metaKey
    )
      return
    if (e.key === 'Tab') {
      if (open) commit(active)
      return
    }
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
      }
      return
    }
    if (
      ['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'].includes(
        e.key,
      )
    ) {
      e.preventDefault()
      e.stopPropagation()
      if (!open) begin()
      if (e.key === 'Home') setActive(first())
      else if (e.key === 'End') {
        const last = options.findLastIndex((o) => !o.disabled)
        if (last >= 0) setActive(last)
      } else if (open)
        move(
          e.key === 'ArrowDown'
            ? 1
            : e.key === 'ArrowUp'
              ? -1
              : e.key === 'PageDown'
                ? 10
                : -10,
        )
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      if (open) commit(active)
      else begin()
      return
    }
    if (e.key.length === 1 && !e.altKey) {
      e.preventDefault()
      e.stopPropagation()
      if (!open) begin()
      const now = performance.now(),
        old = now - search.current.at < 700 ? search.current.text : ''
      const repeated = old && [...old].every((c) => c === e.key.toLowerCase())
      const text = repeated ? e.key.toLowerCase() : old + e.key.toLowerCase()
      search.current = { text, at: now }
      const base = open ? active : Math.max(0, selected)
      for (let n = repeated || !old ? 1 : 0; n <= options.length; n++) {
        const i = (base + n) % options.length
        if (
          !options[i].disabled &&
          options[i].label.toLowerCase().startsWith(text)
        ) {
          setActive(i)
          break
        }
      }
    }
  }
  return (
    <>
      <button
        type="button"
        id={id ?? generated}
        ref={button}
        role="combobox"
        className="custom-select"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        aria-activedescendant={open ? `${popupId}-${active}` : undefined}
        disabled={disabled || !options.some((o) => !o.disabled)}
        data-value={value}
        onClick={() => (open ? setOpen(false) : begin())}
        onKeyDown={key}
        onBlur={(e) => {
          if (!list.current?.contains(e.relatedTarget)) setOpen(false)
        }}
      >
        <span>{options[selected]?.label ?? '選択してください'}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            id={popupId}
            ref={list}
            role="listbox"
            aria-label={label}
            className="select-popup"
            style={{ position: 'fixed', ...box }}
            onPointerDown={(e) => e.preventDefault()}
          >
            {options.map((option, i) => (
              <div
                id={`${popupId}-${i}`}
                key={option.value}
                role="option"
                aria-selected={value === option.value}
                aria-disabled={!!option.disabled}
                data-value={option.value}
                data-index={i}
                data-active={i === active}
                onPointerMove={() => {
                  if (!option.disabled) setActive(i)
                }}
                onClick={() => commit(i)}
                className="select-option"
              >
                <span>{option.label}</span>
                {value === option.value && (
                  <Check size={15} aria-hidden="true" />
                )}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
