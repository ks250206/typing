import { mapKey } from './engine'
import type { Layout } from './engine'
import type { Sentence } from './sentences'
import { romanWordStarts, sentenceWordStarts } from './wordSpacing'

const letters = (text: string) => [...text].map((c) => `Key${c}`)
export const keyboardRows = [
  [
    ...Array.from({ length: 10 }, (_, i) => `Digit${(i + 1) % 10}`),
    'Minus',
    'Equal',
  ],
  [...letters('QWERTYUIOP'), 'BracketLeft', 'BracketRight'],
  [...letters('ASDFGHJKL'), 'Semicolon', 'Quote'],
  ['ShiftLeft', ...letters('ZXCVBNM'), 'Comma', 'Period', 'Slash'],
]
const usSymbols: Record<string, string[]> = {
  Minus: ['-', '_'],
  Equal: ['=', '+'],
  BracketLeft: ['[', '{'],
  BracketRight: [']', '}'],
  Backslash: ['\\', '|'],
  Semicolon: [';', ':'],
  Quote: ["'", '"'],
  Comma: [',', '<'],
  Period: ['.', '>'],
  Slash: ['/', '?'],
}
const jisSymbols: Record<string, string[]> = {
  ...usSymbols,
  Equal: ['^', '~'],
  BracketLeft: ['@', '`'],
  BracketRight: ['[', '{'],
  Backslash: [']', '}'],
  Semicolon: [';', '+'],
  Quote: [':', '*'],
  IntlYen: ['¥', '|'],
  IntlRo: ['\\', '_'],
}
export function keyboardCodes(layout: Layout) {
  const jis = layout === 'jis' || layout === 'kana'
  return keyboardRows
    .map((row, index) => [
      ...row,
      ...(index === 0 && jis ? ['IntlYen'] : []),
      ...(index === (jis ? 2 : 1) ? ['Backslash'] : []),
      ...(index === 3 ? [...(jis ? ['IntlRo'] : []), 'ShiftRight'] : []),
    ])
    .concat([['Space']])
}
export function keyOutput(code: string, shift: boolean, layout: Layout) {
  if (code.startsWith('Shift')) return null
  const jis = layout === 'jis' || layout === 'kana'
  let key = ''
  if (code.startsWith('Key')) key = code.slice(3).toLowerCase()
  else if (code.startsWith('Digit')) {
    const digit = Number(code.slice(5))
    key = shift ? (jis ? ')!"#$%&\'()' : ')!@#$%^&*(')[digit] : String(digit)
    if (jis && shift && digit === 0) key = ''
  } else key = (jis ? jisSymbols : usSymbols)[code]?.[Number(shift)] ?? ''
  return mapKey({ code, key, shiftKey: shift }, layout)
}
export function physicalKey(character: string, layout: Layout) {
  for (const shift of [false, true]) {
    for (const code of keyboardCodes(layout).flat()) {
      if (keyOutput(code, shift, layout) === character) return { code, shift }
    }
  }
}
export function fingerFor(code: string) {
  if (code === 'Space') return 'thumb'
  if (/^(Digit1|Key[QAZ]|ShiftLeft)$/.test(code)) return 'left-pinky'
  if (/^(Digit2|Key[WSX])$/.test(code)) return 'left-ring'
  if (/^(Digit3|Key[EDC])$/.test(code)) return 'left-middle'
  if (/^(Digit[45]|Key[RTFGVB])$/.test(code)) return 'left-index'
  if (/^(Digit[67]|Key[YUHJNM])$/.test(code)) return 'right-index'
  if (/^(Digit8|Key[IK]|Comma)$/.test(code)) return 'right-middle'
  if (/^(Digit9|Key[OL]|Period)$/.test(code)) return 'right-ring'
  return 'right-pinky'
}
export function shiftFor(code: string) {
  return fingerFor(code).startsWith('left') ? 'ShiftRight' : 'ShiftLeft'
}

/** Only the remainder of the current word; the next key follows the active spelling. */
export function wordHint(
  sentence: Sentence,
  layout: Layout,
  position: number,
  typed: string,
  hint: string,
) {
  const starts = sentenceWordStarts(sentence).reading
  if (layout === 'kana') {
    const end = [...starts]
      .map(
        (offset) => sentence.reading.slice(0, offset).normalize('NFD').length,
      )
      .find((offset) => offset > position)
    return sentence.reading.normalize('NFD').slice(position, end)
  }
  const end = [...romanWordStarts(sentence.reading, typed + hint, starts)].find(
    (offset) => offset > typed.length,
  )
  return hint.slice(0, end === undefined ? undefined : end - typed.length)
}
