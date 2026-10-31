import { memo, useMemo } from 'react'
import type { Layout } from '../../domain/typing/engine'
import type { MissedKey } from './useKeyFeedback'
import {
  fingerFor,
  keyboardGeometry,
  keyOutput,
  physicalKey,
  shiftFor,
  usesJisGeometry,
} from '../../domain/typing/physicalKeyboard'
const display = (value: string | null) =>
  value === '\u3099' ? '゛' : value === '\u309a' ? '゜' : value
const specialLabels: Record<string, string> = {
  Escape: 'Esc',
  Backquote: '半角',
  Backspace: 'Backspace',
  Tab: 'Tab',
  CapsLock: 'Caps',
  Enter: 'Enter ↵',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  Space: 'Space',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
  MetaLeft: '◇',
  MetaRight: '◇',
  AltLeft: 'Alt',
  AltRight: 'Alt',
  NonConvert: '無変換',
  Convert: '変換',
  KanaMode: 'かな',
  Fn: 'Fn',
}
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
  nextCharacter,
  enabled,
  missedKey,
}: {
  layout: Layout
  nextCharacter: string
  enabled: boolean
  missedKey?: MissedKey | null
}) {
  const slots = useMemo(() => keyboardGeometry(layout), [layout])
  const next = enabled ? physicalKey(nextCharacter, layout) : undefined
  const nextCodes = new Set(
    next
      ? [
          next.code,
          ...(next.shift ? [shiftFor(next.code)] : []),
          ...(next.altGraph ? ['AltRight'] : []),
        ]
      : [],
  )
  return (
    <figure className="keyboard-guide" aria-label="指別キーボードガイド">
      <div
        className={`physical-keyboard ${usesJisGeometry(layout) ? 'is-jis' : ''}`}
        aria-hidden="true"
      >
        {slots.map(({ code, row, column, width, tall }) => {
          const special =
            code === 'Backquote' && !usesJisGeometry(layout)
              ? undefined
              : code === 'AltRight' && layout === 'azerty'
                ? 'AltGr'
                : specialLabels[code]
          const base = display(keyOutput(code, false, layout))
          const shifted = display(keyOutput(code, true, layout))
          const alt =
            layout === 'azerty'
              ? display(keyOutput(code, false, layout, undefined, true))
              : null
          return (
            <span
              key={code}
              data-code={code}
              data-finger={fingerFor(code)}
              data-state={nextCodes.has(code) ? 'next' : 'idle'}
              data-error={
                enabled && missedKey?.code === code ? 'true' : undefined
              }
              data-width={width}
              className={`keyboard-key ${homeCodes.has(code) ? 'home-key' : ''} ${special ? 'special-key' : ''} ${tall ? 'enter-tall' : ''}`}
              style={{
                gridColumn: `${column} / span ${width}`,
                gridRow: `${row} / span ${tall ? 2 : 1}`,
              }}
            >
              {enabled && missedKey && nextCodes.has(code) && (
                <i key={missedKey.serial} className="next-key-pulse" />
              )}
              {alt && <sub className="altgr-symbol">{alt}</sub>}
              {!special && shifted && shifted !== base && (
                <small>{shifted}</small>
              )}
              <span>
                {special ?? (layout === 'kana' ? base : base?.toUpperCase())}
              </span>
              {(code === 'KeyF' || code === 'KeyJ') && (
                <i className="home-ridge" />
              )}
            </span>
          )
        })}
      </div>
      <div className="keyboard-legend">
        {['小指', '薬指', '中指', '人差し指', '親指'].map((finger, index) => (
          <span key={finger} data-tone={index}>
            {finger}
          </span>
        ))}
      </div>
    </figure>
  )
})
