import { useEffect, useRef } from 'react'

/** Only the mounted game page installs shortcuts; typing and menus keep their keys. */
export function useGameShortcuts(
  resolve: (event: KeyboardEvent) => (() => void) | undefined,
) {
  const current = useRef(resolve)
  useEffect(() => {
    current.current = resolve
  }, [resolve])
  useEffect(() => {
    const held = new Set<string>()
    const keydown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      )
        return
      const key = event.code || event.key
      const action = current.current(event)
      if (!held.has(key) && !action) return
      if (
        document.querySelector('[aria-modal="true"]') ||
        (event.target instanceof Element &&
          event.target.closest(
            '[data-game-shortcuts="off"], input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="listbox"], [role="slider"]',
          ))
      )
        return
      // Consume repeats even after the action changes the game's phase or focus.
      event.preventDefault()
      event.stopPropagation()
      if (held.has(key) || event.repeat) return
      held.add(key)
      action?.()
    }
    const keyup = (event: KeyboardEvent) => {
      if (held.delete(event.code || event.key)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    const clear = () => held.clear()
    // Capture before the game's input handler or a button's default activation.
    window.addEventListener('keydown', keydown, true)
    window.addEventListener('keyup', keyup, true)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', keydown, true)
      window.removeEventListener('keyup', keyup, true)
      window.removeEventListener('blur', clear)
    }
  }, [])
}
