import { memo, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { locateSegments } from '../../domain/content/sentences'
import type { Sentence } from '../../domain/content/sentences'
import { RubyText, RubyToken } from './RubyText'
import { useSingleLineFlow } from './useSingleLineFlow'
import { ReadingGuide } from './ReadingGuide'
import {
  consumedOffsets,
  sentenceWordStarts,
  wordTone,
} from '../../domain/typing/wordSpacing'

export const SentenceView = memo(function SentenceView({
  current,
  next,
  position,
  kana,
  done,
  target,
  typed,
  hint,
  wordColors,
  consumeTyped,
  showNext = true,
  partialRoman = false,
  romanGuide,
}: {
  current: Sentence
  next?: Sentence
  position: number
  kana: boolean
  done: boolean
  target: string
  typed: string
  hint: string
  wordColors: boolean
  consumeTyped: boolean
  showNext?: boolean
  partialRoman?: boolean
  romanGuide?: ReactNode
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
    ? consumedOffsets(
        target,
        position,
        typed,
        hint,
        words.reading,
        done,
        partialRoman,
      )
    : { reading: 0, input: 0, roman: 0 }
  useSingleLineFlow(
    host,
    `${target}/${position}/${typed}/${consumed.input}`,
    position === 0 && !typed,
    consumeTyped,
    '[aria-current="location"]',
  )
  return (
    <div
      className={`prose ${wordColors ? 'word-colors' : ''}`}
      data-flow={consumeTyped ? 'consume' : 'dim'}
    >
      <div className="sentence-label">
        {done ? 'COMPLETE' : (current.label ?? 'NOW / 現在の文章')}
      </div>
      <p
        className="current-paragraph"
        ref={host}
        data-text={current.text}
        data-continuous={current.continuous || undefined}
      >
        <span className="sentence-stream flow-track">
          {segments.map((segment, index) => {
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
                data-consumed={
                  consumeTyped && segment.end <= consumed.input
                    ? 'true'
                    : undefined
                }
                aria-hidden={
                  consumeTyped && segment.end <= consumed.input
                    ? true
                    : undefined
                }
                data-word-anchor={
                  consumeTyped && segment.start === consumed.input
                    ? ''
                    : undefined
                }
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
        showRoman={!kana}
        partialRoman={partialRoman}
        romanGuide={romanGuide}
        done={done}
      />
      {showNext && !current.continuous && !done && next && (
        <div className="next-sentence">
          <div className="sentence-label">UP NEXT / 次の文章</div>
          <p className="upcoming" data-text={next.text}>
            <RubyText segments={next.segments} />
          </p>
        </div>
      )}
    </div>
  )
})
