import { mapKey } from './engine'
import type { Layout } from './engine'

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
      ...(index === 0 ? ['Backquote'] : []),
      ...row,
      ...(index === 0 && jis ? ['IntlYen'] : []),
      ...(index === (jis ? 2 : 1) ? ['Backslash'] : []),
      ...(index === 3 ? [...(jis ? ['IntlRo'] : []), 'ShiftRight'] : []),
    ])
    .concat([['Space']])
}
export function keyOutput(
  code: string,
  shift: boolean,
  layout: Layout,
  expected?: string,
) {
  if (code.startsWith('Shift')) return null
  const jis = layout === 'jis' || layout === 'kana'
  let key = ''
  if (code.startsWith('Key')) key = code.slice(3).toLowerCase()
  else if (code.startsWith('Digit')) {
    const digit = Number(code.slice(5))
    key = shift ? (jis ? ')!"#$%&\'()' : ')!@#$%^&*(')[digit] : String(digit)
    if (jis && shift && digit === 0) key = ''
  } else key = (jis ? jisSymbols : usSymbols)[code]?.[Number(shift)] ?? ''
  return mapKey({ code, key, shiftKey: shift }, layout, expected)
}
export function physicalKey(character: string, layout: Layout) {
  for (const shift of [false, true]) {
    for (const code of keyboardCodes(layout).flat()) {
      if (keyOutput(code, shift, layout, character) === character)
        return { code, shift }
    }
  }
}
export function fingerFor(code: string) {
  if (['Space', 'NonConvert', 'Convert', 'KanaMode'].includes(code))
    return 'thumb'
  if (['ControlLeft', 'MetaLeft', 'AltLeft'].includes(code)) return 'left-pinky'
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

export interface KeySlot {
  code: string
  row: number
  column: number
  width: number
  tall?: boolean
}
/** Quarter-key units keep the same pitch across rows (15 standard key units). */
export function keyboardGeometry(layout: Layout): KeySlot[] {
  const jis = layout === 'jis' || layout === 'kana'
  const slots: KeySlot[] = [{ code: 'Escape', row: 1, column: 1, width: 4 }]
  for (let index = 0; index < 12; index++)
    slots.push({
      code: `F${index + 1}`,
      row: 1,
      column: 9 + index * 4 + Math.floor(index / 4) * 2,
      width: 4,
    })
  const add = (row: number, keys: [string, number][]) => {
    let column = 1
    for (const [code, width] of keys) {
      slots.push({ code, row, column, width })
      column += width
    }
  }
  const regular = (keys: string[]): [string, number][] =>
    keys.map((code) => [code, 4])
  add(2, [
    ['Backquote', 4],
    ...regular(keyboardRows[0]),
    ...(jis ? [['IntlYen', 4] as [string, number]] : []),
    ['Backspace', jis ? 4 : 8],
  ])
  add(3, [
    ['Tab', 6],
    ...regular(keyboardRows[1]),
    ...(jis ? [] : [['Backslash', 6] as [string, number]]),
  ])
  if (jis)
    slots.push({ code: 'Enter', row: 3, column: 55, width: 6, tall: true })
  add(4, [
    ['CapsLock', 7],
    ...regular([...letters('ASDFGHJKL'), 'Semicolon', 'Quote']),
    [jis ? 'Backslash' : 'Enter', jis ? 4 : 9],
  ])
  add(5, [
    ['ShiftLeft', 9],
    ...regular([...letters('ZXCVBNM'), 'Comma', 'Period', 'Slash']),
    ...(jis ? [['IntlRo', 4] as [string, number]] : []),
    ['ShiftRight', jis ? 7 : 11],
  ])
  add(
    6,
    jis
      ? [
          ['ControlLeft', 5],
          ['MetaLeft', 5],
          ['AltLeft', 5],
          ['NonConvert', 5],
          ['Space', 14],
          ['Convert', 5],
          ['KanaMode', 6],
          ['AltRight', 5],
          ['Fn', 5],
          ['ControlRight', 5],
        ]
      : [
          ['ControlLeft', 5],
          ['MetaLeft', 5],
          ['AltLeft', 5],
          ['Space', 30],
          ['AltRight', 5],
          ['MetaRight', 5],
          ['ControlRight', 5],
        ],
  )
  return slots
}
