import { mapKey } from './engine'
import type { Layout } from './engine'

export const usesJisGeometry = (layout: Layout) =>
  layout === 'jis' || layout === 'kana' || layout === 'nova-f5-pair'

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
  const jis = usesJisGeometry(layout)
  return keyboardRows
    .map((row, index) => [
      ...(index === 0 ? ['Backquote'] : []),
      ...row,
      ...(index === 0 && jis ? ['IntlYen'] : []),
      ...(index === (jis ? 2 : 1) ? ['Backslash'] : []),
      ...(index === 3
        ? [
            ...(jis ? ['IntlRo'] : []),
            ...(layout === 'azerty' ? ['IntlBackslash'] : []),
            'ShiftRight',
          ]
        : []),
    ])
    .concat([['Space']])
}
export function keyOutput(
  code: string,
  shift: boolean,
  layout: Layout,
  expected?: string,
  altGraph = false,
) {
  if (code.startsWith('Shift')) return null
  const jis = usesJisGeometry(layout)
  let key = ''
  if (code.startsWith('Key')) key = code.slice(3).toLowerCase()
  else if (code.startsWith('Digit')) {
    const digit = Number(code.slice(5))
    key = shift ? (jis ? ')!"#$%&\'()' : ')!@#$%^&*(')[digit] : String(digit)
    if (jis && shift && digit === 0) key = ''
  } else key = (jis ? jisSymbols : usSymbols)[code]?.[Number(shift)] ?? ''
  return mapKey(
    {
      code,
      key,
      shiftKey: shift,
      getModifierState: (name) => name === 'AltGraph' && altGraph,
    },
    layout,
    expected,
  )
}
export function physicalKey(character: string, layout: Layout) {
  for (const [shift, altGraph] of [
    [false, false],
    [true, false],
    ...(layout === 'azerty' ? [[false, true]] : []),
  ]) {
    for (const code of keyboardCodes(layout).flat()) {
      if (keyOutput(code, shift, layout, character, altGraph) === character)
        return { code, shift, ...(altGraph ? { altGraph: true } : {}) }
    }
  }
}
export function fingerFor(code: string) {
  if (['Space', 'NonConvert', 'Convert', 'KanaMode'].includes(code))
    return 'thumb'
  if (['ControlLeft', 'MetaLeft', 'AltLeft', 'IntlBackslash'].includes(code))
    return 'left-pinky'
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
  const jis = usesJisGeometry(layout)
  const slots: KeySlot[] = []
  const iso = layout === 'azerty'
  const add = (row: number, keys: [string, number][]) => {
    let column = 1
    for (const [code, width] of keys) {
      slots.push({ code, row, column, width })
      column += width
    }
  }
  const regular = (keys: string[]): [string, number][] =>
    keys.map((code) => [code, 4])
  add(1, [
    ['Backquote', 4],
    ...regular(keyboardRows[0]),
    ...(jis ? [['IntlYen', 4] as [string, number]] : []),
    ['Backspace', jis ? 4 : 8],
  ])
  add(2, [
    ['Tab', 6],
    ...regular(keyboardRows[1]),
    ...(jis || iso ? [] : [['Backslash', 6] as [string, number]]),
  ])
  if (jis || iso)
    slots.push({ code: 'Enter', row: 2, column: 55, width: 6, tall: true })
  add(3, [
    ['CapsLock', 7],
    ...regular([...letters('ASDFGHJKL'), 'Semicolon', 'Quote']),
    [jis || iso ? 'Backslash' : 'Enter', jis || iso ? 4 : 9],
  ])
  add(4, [
    ['ShiftLeft', iso ? 5 : 9],
    ...(iso ? [['IntlBackslash', 4] as [string, number]] : []),
    ...regular([...letters('ZXCVBNM'), 'Comma', 'Period', 'Slash']),
    ...(jis ? [['IntlRo', 4] as [string, number]] : []),
    ['ShiftRight', jis ? 7 : 11],
  ])
  add(
    5,
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
