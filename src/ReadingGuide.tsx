import { useLayoutEffect, useMemo, useRef } from 'react'

import { SpacedText } from './SpacedText'
import { romanWordStarts } from './wordSpacing'
import { readingCursor } from './readingCursor'

export function ReadingGuide({
  wordStarts,
  target,
  position,
  typed,
  hint,
  showRoman,
  done,
}: {
  wordStarts: Set<number>
  target: string
  position: number
  typed: string
  hint: string
  showRoman: boolean
  done: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  const reading = readingCursor(target, position)
  const romanStarts = useMemo(
    () =>
      showRoman
        ? romanWordStarts(target, typed + hint, wordStarts)
        : new Set<number>(),
    [target, typed, hint, wordStarts, showRoman],
  )
  const kanaOffset = reading.before.length
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
        <div className="guide-line kana-line" aria-label="ひらがなの読み">
          <span className="typed-kana">
            <SpacedText text={reading.before} boundaries={wordStarts} />
          </span>
          <span className="remaining-kana">
            {!done && reading.current && (
              <span className="guide-current" data-guide-cursor>
                <SpacedText
                  text={reading.current}
                  start={kanaOffset}
                  boundaries={wordStarts}
                />
              </span>
            )}
            <SpacedText
              text={reading.after}
              start={kanaOffset + reading.current.length}
              boundaries={wordStarts}
            />
          </span>
        </div>
      </div>
      {showRoman && (
        <div className="guide-row">
          <div
            className="guide-line roman-line"
            aria-label="ローマ字入力ガイド"
          >
            <span className="typed-roman">
              <SpacedText text={typed} boundaries={romanStarts} />
            </span>
            {!done && hint && (
              <>
                <span className="roman-current guide-current" data-guide-cursor>
                  <SpacedText
                    text={hint[0]}
                    start={typed.length}
                    boundaries={romanStarts}
                  />
                </span>
                <span className="remaining-roman">
                  <SpacedText
                    text={hint.slice(1)}
                    start={typed.length + 1}
                    boundaries={romanStarts}
                  />
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
