import { memo, useMemo } from 'react'
import type { Layout } from './engine'
import {
  fingerFor,
  keyboardCodes,
  keyOutput,
  physicalKey,
  shiftFor,
} from './physicalKeyboard'

const display = (value: string | null) =>
  value === '\u3099' ? '゛' : value === '\u309a' ? '゜' : value
const homeCodes = new Set([
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyF',
  'KeyJ',
  'KeyK',
  'KeyL',
  'Semicolon',
])
export const KeyboardGuide = memo(function KeyboardGuide({
  layout,
  word,
  enabled,
}: {
  layout: Layout
  word: string
  enabled: boolean
}) {
  const rows = useMemo(() => keyboardCodes(layout), [layout])
  const next = enabled ? physicalKey(word[0] ?? '', layout) : undefined
  const wordKeys = new Set<string>()
  if (enabled)
    for (const char of word) {
      const key = physicalKey(char, layout)
      if (!key) continue
      wordKeys.add(key.code)
      if (key.shift) wordKeys.add(shiftFor(key.code))
    }
  const nextCodes = new Set(
    next ? [next.code, ...(next.shift ? [shiftFor(next.code)] : [])] : [],
  )
  return (
    <figure className="keyboard-guide" aria-label="指別キーボードガイド">
      <figcaption>
        <span>KEYBOARD / 指のガイド</span>
        <span className="next-key-label">
          次のキー{' '}
          <strong>
            {next ? `${next.shift ? 'Shift + ' : ''}${display(word[0])}` : '—'}
          </strong>
        </span>
      </figcaption>
      <div className="keyboard-deck" aria-hidden="true">
        {rows.map((row, index) => (
          <div className={`keyboard-row keyboard-row-${index}`} key={index}>
            {row.map((code) => {
              const special = code.startsWith('Shift')
                ? 'Shift'
                : code === 'Space'
                  ? 'Space'
                  : null
              const base = display(keyOutput(code, false, layout))
              const shifted = display(keyOutput(code, true, layout))
              return (
                <span
                  key={code}
                  data-code={code}
                  data-finger={fingerFor(code)}
                  data-state={
                    nextCodes.has(code)
                      ? 'next'
                      : wordKeys.has(code)
                        ? 'word'
                        : 'idle'
                  }
                  className={`keyboard-key ${homeCodes.has(code) ? 'home-key' : ''} ${special ? 'wide-key' : ''}`}
                >
                  {!special && shifted && shifted !== base && (
                    <small>{shifted}</small>
                  )}
                  <span>{special ?? base}</span>
                  {(code === 'KeyF' || code === 'KeyJ') && (
                    <i className="home-ridge" />
                  )}
                </span>
              )
            })}
          </div>
        ))}
      </div>
      <div className="keyboard-legend">
        {['小指', '薬指', '中指', '人差し指', '親指'].map((finger, index) => (
          <span key={finger} data-tone={index}>
            {finger}
          </span>
        ))}
        <span className="keyboard-state-legend">
          淡い光：単語のキー · 強い光：次の一打
        </span>
      </div>
    </figure>
  )
})
