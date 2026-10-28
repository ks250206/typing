import { useMemo, useRef } from 'react'

import { useSingleLineFlow } from './useSingleLineFlow'
import { SpacedText } from './SpacedText'
import { romanWordStarts } from './wordSpacing'
import { readingCursor } from './readingCursor'

export function ReadingGuide({
  consumed,
  consumeTyped,
  wordStarts,
  target,
  position,
  typed,
  hint,
  showRoman,
  partialRoman = false,
  done,
}: {
  consumed: { reading: number; roman: number }
  consumeTyped: boolean
  wordStarts: Set<number>
  target: string
  position: number
  typed: string
  hint: string
  showRoman: boolean
  partialRoman?: boolean
  done: boolean
}) {
  const kanaHost = useRef<HTMLDivElement>(null)
  const romanHost = useRef<HTMLDivElement>(null)
  const reading = readingCursor(target, position)
  const romanStarts = useMemo(
    () =>
      showRoman
        ? romanWordStarts(target, typed + hint, wordStarts, partialRoman)
        : new Set<number>(),
    [target, typed, hint, wordStarts, showRoman, partialRoman],
  )
  const kanaOffset = reading.before.length
  const revision = `${target}/${position}/${typed}/${showRoman}`
  useSingleLineFlow(
    kanaHost,
    revision,
    !position && !typed,
    consumeTyped,
    '[data-guide-cursor]',
  )
  useSingleLineFlow(
    romanHost,
    revision,
    !position && !typed,
    consumeTyped,
    '[data-guide-cursor]',
  )
  return (
    <div className="sentence-guides">
      <div className="guide-row">
        <div
          className="guide-line kana-line"
          aria-label="ひらがなの読み"
          ref={kanaHost}
        >
          <span className="flow-track">
            <span className="typed-kana">
              <SpacedText
                text={reading.before}
                hideBefore={consumed.reading}
                boundaries={wordStarts}
              />
            </span>
            <span className="remaining-kana">
              {!done && reading.current && (
                <span className="guide-current" data-guide-cursor>
                  <SpacedText
                    text={reading.current}
                    start={kanaOffset}
                    boundaries={wordStarts}
                    hideBefore={consumed.reading}
                  />
                </span>
              )}
              <SpacedText
                text={reading.after}
                start={kanaOffset + reading.current.length}
                boundaries={wordStarts}
                hideBefore={consumed.reading}
              />
            </span>
          </span>
        </div>
      </div>
      {showRoman && (
        <div className="guide-row">
          <div
            className="guide-line roman-line"
            aria-label="ローマ字入力ガイド"
            ref={romanHost}
          >
            <span className="flow-track">
              <span className="typed-roman">
                <SpacedText
                  text={typed}
                  hideBefore={consumed.roman}
                  boundaries={romanStarts}
                />
              </span>
              {!done && hint && (
                <>
                  <span
                    className="roman-current guide-current"
                    data-guide-cursor
                  >
                    <SpacedText
                      text={hint[0]}
                      start={typed.length}
                      boundaries={romanStarts}
                      hideBefore={consumed.roman}
                    />
                  </span>
                  <span className="remaining-roman">
                    <SpacedText
                      text={hint.slice(1)}
                      start={typed.length + 1}
                      boundaries={romanStarts}
                      hideBefore={consumed.roman}
                    />
                  </span>
                </>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
