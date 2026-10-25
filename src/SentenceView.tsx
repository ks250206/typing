import { useLayoutEffect, useMemo, useRef } from 'react'
import { locateSegments } from './sentences'
import type { Sentence } from './sentences'

export function SentenceView({
  current,
  next,
  position,
  kana,
  done,
}: {
  current: Sentence
  next?: Sentence
  position: number
  kana: boolean
  done: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  const segments = useMemo(() => locateSegments(current, kana), [current, kana])
  useLayoutEffect(() => {
    const el = host.current
    if (!el) return
    const reveal = () => {
      const cursor = el.querySelector('[aria-current="location"]')
      if (!cursor) return
      const rect = cursor.getBoundingClientRect()
      const viewport = el.getBoundingClientRect()
      if (rect.bottom > viewport.bottom)
        el.scrollTop += rect.bottom - viewport.bottom + 12
      else if (rect.top < viewport.top)
        el.scrollTop += rect.top - viewport.top - 12
    }
    if (position === 0) el.scrollTop = 0
    reveal()
    const observer = new ResizeObserver(reveal)
    observer.observe(el)
    return () => observer.disconnect()
  }, [current, position, kana])
  return (
    <div className="prose" ref={host}>
      <div className="sentence-label">
        {done ? 'COMPLETE' : 'NOW / 現在の文章'}
      </div>
      <p className="current-paragraph">
        {segments.map((segment, index) => {
          const active =
            !done && position >= segment.start && position < segment.end
          return (
            <span
              key={index}
              className={
                active
                  ? 'current-token'
                  : done || position >= segment.end
                    ? 'typed-token'
                    : 'pending-token'
              }
              aria-current={active ? 'location' : undefined}
            >
              {segment.text}
            </span>
          )
        })}
      </p>
      {!done && next && (
        <div className="next-sentence">
          <div className="sentence-label">UP NEXT / 次の文章</div>
          <p className="upcoming">{next.text}</p>
        </div>
      )}
    </div>
  )
}
