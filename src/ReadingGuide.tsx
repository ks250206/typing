import { useLayoutEffect, useRef } from 'react'

/** Keep the next kana visible without moving the page or the full-text preview. */
export function ReadingGuide({
  target,
  position,
}: {
  target: string
  position: number
}) {
  const container = useRef<HTMLDivElement>(null)
  const remaining = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = container.current,
      text = remaining.current?.firstChild
    if (!el || !text) return
    const reveal = () => {
      if (position === 0) {
        el.scrollTop = 0
        return
      }
      const range = document.createRange()
      range.setStart(text, 0)
      range.setEnd(text, Math.min(1, text.textContent?.length ?? 0))
      const cursor = range.getBoundingClientRect(),
        viewport = el.getBoundingClientRect()
      if (cursor.bottom > viewport.bottom)
        el.scrollTop += cursor.bottom - viewport.bottom + 3
      else if (cursor.top < viewport.top)
        el.scrollTop += cursor.top - viewport.top - 3
    }
    reveal()
    const observer = new ResizeObserver(reveal)
    observer.observe(el)
    return () => observer.disconnect()
  }, [target, position])
  return (
    <div className="kana-line" ref={container}>
      <span className="typed-kana">
        {target.slice(0, position).normalize('NFC')}
      </span>
      <span className="remaining-kana" ref={remaining}>
        {target.slice(position).normalize('NFC')}
      </span>
    </div>
  )
}
