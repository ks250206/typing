import { memo, useMemo } from 'react'
import type { Layout } from '../../domain/typing/engine'
import {
  fingerFor,
  keyboardGeometry,
  keyOutput,
  physicalKey,
  shiftFor,
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
}: {
  layout: Layout
  nextCharacter: string
  enabled: boolean
}) {
  const slots = useMemo(() => keyboardGeometry(layout), [layout])
  const next = enabled ? physicalKey(nextCharacter, layout) : undefined
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
            {next
              ? `${next.shift ? 'Shift + ' : ''}${display(nextCharacter)}`
              : '—'}
          </strong>
        </span>
      </figcaption>
      <div
        className={`physical-keyboard ${layout === 'jis' || layout === 'kana' ? 'is-jis' : ''}`}
        aria-hidden="true"
      >
        {slots.map(({ code, row, column, width, tall }) => {
          const special =
            specialLabels[code] ?? (/^F\d+$/.test(code) ? code : undefined)
          const base = display(keyOutput(code, false, layout))
          const shifted = display(keyOutput(code, true, layout))
          return (
            <span
              key={code}
              data-code={code}
              data-finger={fingerFor(code)}
              data-state={nextCodes.has(code) ? 'next' : 'idle'}
              data-width={width}
              className={`keyboard-key ${homeCodes.has(code) ? 'home-key' : ''} ${special ? 'special-key' : ''} ${tall ? 'enter-tall' : ''}`}
              style={{
                gridColumn: `${column} / span ${width}`,
                gridRow: `${row} / span ${tall ? 2 : 1}`,
              }}
            >
              {!special && shifted && shifted !== base && (
                <small>{shifted}</small>
              )}
              <span>
                {code === 'Backquote' && layout !== 'jis' && layout !== 'kana'
                  ? '`'
                  : (special ??
                    (layout === 'kana' ? base : base?.toUpperCase()))}
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
        <span className="keyboard-state-legend">光るキーが次の一打</span>
      </div>
    </figure>
  )
})
