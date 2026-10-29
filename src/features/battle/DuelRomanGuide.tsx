import { memo, useMemo, useRef } from 'react'
import type { Sentence } from '../../domain/content/sentences'
import { RomanEngine } from '../../domain/typing/engine'
import { sentenceWordStarts, romanWordStarts } from '../../domain/typing/wordSpacing'
import { duelProjection } from '../../domain/typing/duelRoman'
import { useSingleLineFlow } from '../../shared/typing/useSingleLineFlow'

export const DuelRomanGuide = memo(function DuelRomanGuide({
  sentence,
  typed,
  hint,
  playerPosition,
  cpuKeys,
  kana,
}: {
  sentence: Sentence
  typed: string
  hint: string
  playerPosition: number
  cpuKeys: number
  kana: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  const text = useMemo(
    () => (kana ? new RomanEngine(sentence.reading).hint : typed + hint),
    [kana, sentence, typed, hint],
  )
  const project = useMemo(
    () => duelProjection(sentence.reading, text),
    [sentence, text],
  )
  const cpu = project(cpuKeys, kana)
  const player = kana ? project(playerPosition, true) : typed.length
  const boundaries = useMemo(
    () =>
      romanWordStarts(
        sentence.reading,
        text,
        sentenceWordStarts(sentence).reading,
      ),
    [sentence, text],
  )
  const lead =
    player === cpu ? '同じ位置' : player > cpu ? 'YOU が先行' : 'CPU が先行'
  useSingleLineFlow(
    host,
    `${sentence.reading}/${text}/${player}/${cpu}`,
    player === 0 && cpu === 0,
    false,
    '[data-duel-lead]',
  )
  const cells = (start: number, end: number) =>
    [...text.slice(start, end)].map((char, i) => {
      const offset = start + i
      return (
        <span
          key={offset}
          className={`duel-cell ${boundaries.has(offset) ? 'word-start' : ''}`}
          data-column={offset}
        >
          {char}
        </span>
      )
    })
  const row = (who: 'player' | 'cpu', cursor: number) => (
    <div
      className={`duel-row duel-row-${who}`}
      aria-label={who === 'player' ? 'ローマ字入力ガイド' : 'CPUのローマ字入力'}
    >
      <span className={who === 'player' ? 'typed-roman' : 'opponent-typed'}>
        {cells(0, cursor)}
      </span>
      <span
        className={`duel-current ${who === 'player' ? 'roman-current' : 'opponent-current'}`}
        data-duel-lead={cursor === Math.max(player, cpu) ? '' : undefined}
        data-cursor={cursor}
      >
        {cursor < text.length ? (
          cells(cursor, cursor + 1)
        ) : (
          <span className="duel-end" />
        )}
      </span>
      <span
        className={who === 'player' ? 'remaining-roman' : 'opponent-remaining'}
      >
        {cells(cursor + 1, text.length)}
      </span>
    </div>
  )
  return (
    <div className="duel-roman">
      <div className="duel-lead" aria-label="入力の先行状況">
        {lead}
      </div>
      <div className="duel-labels" aria-hidden="true">
        <span>YOU</span>
        <span>CPU</span>
      </div>
      <div className="guide-line duel-viewport" ref={host}>
        <div className="flow-track duel-track">
          {row('player', player)}
          {row('cpu', cpu)}
        </div>
      </div>
    </div>
  )
})
