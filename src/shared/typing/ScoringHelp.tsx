import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CircleHelp, X } from 'lucide-react'
import { displayZoom } from '../ui/displayZoom'

export function ScoringHelp() {
  const [open, setOpen] = useState(false)
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    if (!open) return
    const position = () => {
      if (!trigger.current || !popup.current) return
      const zoom = displayZoom()
      const rect = trigger.current.getBoundingClientRect()
      const width = Math.min(340, innerWidth / zoom - 16)
      popup.current.style.width = `${width}px`
      const height = popup.current.getBoundingClientRect().height / zoom
      const below = rect.bottom / zoom + 8
      popup.current.style.left = `${Math.max(8, Math.min(rect.right / zoom - width, innerWidth / zoom - width - 8))}px`
      popup.current.style.top = `${below + height <= innerHeight / zoom - 8 ? below : Math.max(8, rect.top / zoom - height - 8)}px`
      popup.current.style.visibility = 'visible'
    }
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [open])
  useEffect(() => {
    if (!open) return
    const outside = (event: Event) => {
      const target = event.target as Node
      if (
        !trigger.current?.contains(target) &&
        !popup.current?.contains(target)
      )
        setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('focusin', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }
  return (
    <>
      <button
        ref={trigger}
        className="icon-button scoring-help"
        aria-label="採点方法を開く"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-describedby={open ? id : undefined}
        data-game-shortcuts="off"
        onClick={() => setOpen((value) => !value)}
      >
        <CircleHelp size={15} />
      </button>
      {open &&
        createPortal(
          <section
            id={id}
            ref={popup}
            className="scoring-popup"
            role="note"
            aria-label="採点と称号"
            data-game-shortcuts="off"
          >
            <button
              className="icon-button scoring-popup-close"
              aria-label="採点ヘルプを閉じる"
              onClick={close}
            >
              <X size={15} />
            </button>
            <h3>採点と称号</h3>
            <p>入力後に精度称号を判定</p>
            <p>正打鍵KPM × 補正正確率²</p>
            <p>連続ミス減点 1 / .75 / .5 / .35 / .25（5回〜）</p>
          </section>,
          document.body,
        )}
    </>
  )
}
