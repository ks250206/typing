import { useEffect, useRef } from 'react'

export function useModalFocus(onClose: () => void) {
  const modalRef = useRef<HTMLElement>(null)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const modal = modalRef.current
    const controls = () =>
      Array.from(
        modal?.querySelectorAll<HTMLElement>(
          'button,input,select,[tabindex="0"]',
        ) ?? [],
      ).filter((item) => !item.matches(':disabled,[aria-disabled="true"]'))
    controls()[0]?.focus()
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close.current()
      }
      if (e.key === 'Tab') {
        const items = controls()
        if (!items.length) {
          e.preventDefault()
          modal?.focus()
          return
        }
        const first = items[0],
          last = items.at(-1)
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', handle)
    return () => {
      document.removeEventListener('keydown', handle)
      previous?.focus()
    }
  }, [])
  return modalRef
}
