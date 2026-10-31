import { expect, it } from 'vitest'
import {
  keyOutput,
  physicalKey,
  keyboardCodes,
  keyboardGeometry,
} from './physicalKeyboard'
import { mapKey } from './engine'

// Independently transcribed from upstream diagrams/f5/pair.svg (2026-10-31).
// Empty Shift+1 must remain empty instead of inheriting a host symbol.
const rows = [
  [
    [
      'Digit1',
      'Digit2',
      'Digit3',
      'Digit4',
      'Digit5',
      'Digit6',
      'Digit7',
      'Digit8',
      'Digit9',
      'Digit0',
      'Minus',
      'Equal',
      'IntlYen',
    ],
    '1234567890\'"¥',
    [null, ...'$%~|&+[]?@`^'],
  ],
  [
    [...'QWERTYUIOP']
      .map((k) => `Key${k}`)
      .concat(['BracketLeft', 'BracketRight']),
    '=pu-_vkhygzq',
    '#PU{}VKHYGZQ',
  ],
  [
    [...'ASDFGHJKL']
      .map((k) => `Key${k}`)
      .concat(['Semicolon', 'Quote', 'Backslash']),
    'aieo;mtrnscx',
    'AIEO:MTRNSCX',
  ],
  [
    [...'ZXCVBNM']
      .map((k) => `Key${k}`)
      .concat(['Comma', 'Period', 'Slash', 'IntlRo']),
    '(),./bdlfwj',
    '*<>!\\BDLFWJ',
  ],
] as const

it.each(rows)(
  'matches all NOVA F5-Pair base and Shift outputs on physical row %s',
  (codes, base, shifted) => {
    for (const [index, code] of codes.entries()) {
      expect(keyOutput(code, false, 'nova-f5-pair'), code).toBe(base[index])
      expect(keyOutput(code, true, 'nova-f5-pair'), code).toBe(
        shifted[index]?.toLowerCase() ?? null,
      )
      expect(
        mapKey(
          { code, key: 'unrelated host output', shiftKey: true },
          'nova-f5-pair',
        ),
      ).toBe(shifted[index]?.toLowerCase() ?? null)
    }
  },
)

it('uses JIS geometry and finds every published output, without a half-width or Shift+1 fallback', () => {
  expect(keyboardGeometry('nova-f5-pair')).toEqual(keyboardGeometry('jis'))
  expect(keyboardCodes('nova-f5-pair')).toEqual(keyboardCodes('jis'))
  expect(keyOutput('Backquote', false, 'nova-f5-pair')).toBeNull()
  expect(keyOutput('Backquote', true, 'nova-f5-pair')).toBeNull()
  expect(
    mapKey({ code: 'Digit1', key: '!', shiftKey: true }, 'nova-f5-pair'),
  ).toBeNull()
  expect(physicalKey('¥', 'nova-f5-pair')).toEqual({
    code: 'IntlYen',
    shift: false,
  })
  expect(physicalKey('^', 'nova-f5-pair')).toEqual({
    code: 'IntlYen',
    shift: true,
  })
  expect(physicalKey('j', 'nova-f5-pair')).toEqual({
    code: 'IntlRo',
    shift: false,
  })
  expect(physicalKey('x', 'nova-f5-pair')).toEqual({
    code: 'Backslash',
    shift: false,
  })
  expect(physicalKey('\\', 'nova-f5-pair')).toEqual({
    code: 'KeyB',
    shift: true,
  })
  for (const [codes, base, shifted] of rows) {
    for (const char of [...base, ...shifted]) {
      if (!char || /[A-Z]/.test(char)) continue
      const physical = physicalKey(char, 'nova-f5-pair')
      expect(physical, char).toBeDefined()
      expect(codes.length).toBe(base.length)
      expect(keyOutput(physical!.code, physical!.shift, 'nova-f5-pair')).toBe(
        char,
      )
    }
  }
})
