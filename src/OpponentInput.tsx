import { useMemo, useRef } from 'react'
import { opponentRoman } from './opponentRoman'
import { useSingleLineFlow } from './useSingleLineFlow'

export function OpponentInput({
  reading,
  keys,
  kana,
}: {
  reading: string
  keys: number
  kana: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  const value = useMemo(
    () => opponentRoman(reading, keys, kana),
    [reading, keys, kana],
  )
  useSingleLineFlow(
    host,
    `${reading}/${keys}`,
    keys === 0,
    false,
    '[data-cpu-cursor]',
  )
  return (
    <div className="opponent-input">
      <span className="opponent-label">CPU</span>
      <div
        className="guide-line opponent-roman"
        aria-label="CPUのローマ字入力"
        ref={host}
      >
        <span className="flow-track">
          <span className="opponent-typed">{value.typed}</span>
          {value.remaining && (
            <>
              <span className="opponent-current" data-cpu-cursor>
                {value.remaining[0]}
              </span>
              <span className="opponent-remaining">
                {value.remaining.slice(1)}
              </span>
            </>
          )}
        </span>
      </div>
    </div>
  )
}
