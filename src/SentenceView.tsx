import { useLayoutEffect, useMemo, useRef } from 'react'
import { locateSegments } from './sentences'
import type { Sentence } from './sentences'
import { RubyText, RubyToken } from './RubyText'
import { ReadingGuide } from './ReadingGuide'
import { consumedOffsets, sentenceWordStarts, wordTone } from './wordSpacing'

export function SentenceView({
  current,
  next,
  position,
  kana,
  done,
  target,
  typed,
  hint,
  guide,
  wordColors,
  consumeTyped,
}: {
  current: Sentence
  next?: Sentence
  position: number
  kana: boolean
  done: boolean
  target: string
  typed: string
  hint: string
  guide: boolean
  wordColors: boolean
  consumeTyped: boolean
}) {
  const host = useRef<HTMLParagraphElement>(null)
  const segments = useMemo(() => locateSegments(current, kana), [current, kana])
  const words = useMemo(() => sentenceWordStarts(current), [current])
  const inputWordStarts = useMemo(
    () =>
      new Set(
        [...words.reading].map(
          (offset) =>
            current.reading.slice(0, offset).normalize(kana ? 'NFD' : 'NFC')
              .length,
        ),
      ),
    [words, current, kana],
  )
  const consumed = consumeTyped
    ? consumedOffsets(target, position, typed, hint, words.reading, done)
    : { reading: 0, input: 0, roman: 0 }
  useLayoutEffect(() => {
    const el = host.current
    if (!el) return
    const reveal = () => {
      const cursor = el.querySelector('[aria-current="location"]')
      if (!cursor) return
      const rect = cursor.getBoundingClientRect()
      const viewport = el.getBoundingClientRect()
      if (consumeTyped) {
        if (rect.right > viewport.right)
          el.scrollLeft += rect.right - viewport.right + 12
        else if (rect.left < viewport.left)
          el.scrollLeft += rect.left - viewport.left - 12
        return
      }
      if (rect.bottom > viewport.bottom)
        el.scrollTop += rect.bottom - viewport.bottom + 12
      else if (rect.top < viewport.top)
        el.scrollTop += rect.top - viewport.top - 12
    }
    if (position === 0 || consumeTyped) {
      el.scrollTop = 0
      el.scrollLeft = 0
    }
    reveal()
    const observer = new ResizeObserver(reveal)
    observer.observe(el)
    return () => observer.disconnect()
  }, [current, position, kana, consumeTyped])
  return (
    <div
      className={`prose ${wordColors ? 'word-colors' : ''}`}
      data-flow={consumeTyped ? 'consume' : 'dim'}
    >
      <div className="sentence-label">
        {done ? 'COMPLETE' : 'NOW / 現在の文章'}
      </div>
      <p className="current-paragraph" ref={host} data-text={current.text}>
        <span className="sentence-stream" key={consumed.input}>
          {segments.map((segment, index) => {
            if (consumeTyped && segment.end <= consumed.input) return null
            const active =
              !done && position >= segment.start && position < segment.end
            return (
              <span
                key={index}
                className={`${words.segments.has(index) ? 'word-start ' : ''}${
                  active
                    ? 'current-token'
                    : done || position >= segment.end
                      ? 'typed-token'
                      : 'pending-token'
                }`}
                data-tone={wordTone(segment.start, inputWordStarts)}
              >
                <RubyToken {...segment} active={active} />
              </span>
            )
          })}
        </span>
      </p>
      <ReadingGuide
        wordStarts={words.reading}
        consumed={consumed}
        consumeTyped={consumeTyped}
        target={target}
        position={position}
        typed={typed}
        hint={hint}
        showRoman={guide && !kana}
        done={done}
      />
      {!done && next && (
        <div className="next-sentence">
          <div className="sentence-label">UP NEXT / 次の文章</div>
          <p className="upcoming" data-text={next.text}>
            <RubyText segments={next.segments} />
          </p>
        </div>
      )}
    </div>
  )
}
