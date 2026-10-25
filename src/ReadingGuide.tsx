import { useLayoutEffect, useRef } from 'react'

import { readingCursor } from './readingCursor'

export function ReadingGuide({
  target,
  position,
  typed,
  hint,
  showRoman,
  done,
}: {
  target: string
  position: number
  typed: string
  hint: string
  showRoman: boolean
  done: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  const reading = readingCursor(target, position)
  useLayoutEffect(() => {
    const el = host.current
    if (!el) return
    const reveal = () => {
      for (const line of el.querySelectorAll<HTMLElement>('.guide-line')) {
        if (!position && !typed) line.scrollTop = 0
        const cursor = line.querySelector('[data-guide-cursor]')
        if (!cursor) continue
        const rect = cursor.getBoundingClientRect()
        const viewport = line.getBoundingClientRect()
        if (rect.bottom > viewport.bottom)
          line.scrollTop += rect.bottom - viewport.bottom + 3
        else if (rect.top < viewport.top)
          line.scrollTop += rect.top - viewport.top - 3
      }
    }
    reveal()
    const observer = new ResizeObserver(reveal)
    observer.observe(el)
    return () => observer.disconnect()
  }, [target, position, typed, showRoman])
  return (
    <div className="sentence-guides" ref={host}>
      <div className="guide-row">
        <span className="guide-label" aria-hidden="true">
          かな
        </span>
        <div className="guide-line kana-line" aria-label="ひらがなの読み">
          <span className="typed-kana">{reading.before}</span>
          <span className="remaining-kana">
            {!done && reading.current && (
              <span className="guide-current" data-guide-cursor>
                {reading.current}
              </span>
            )}
            {reading.after}
          </span>
        </div>
      </div>
      {showRoman && (
        <div className="guide-row">
          <span className="guide-label" aria-hidden="true">
            ABC
          </span>
          <div
            className="guide-line roman-line"
            aria-label="ローマ字入力ガイド"
          >
            <span className="typed-roman">{typed}</span>
            {!done && hint && (
              <>
                <span className="roman-current guide-current" data-guide-cursor>
                  {hint[0]}
                </span>
                <span className="remaining-roman">{hint.slice(1)}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
