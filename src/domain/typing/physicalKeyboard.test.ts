import { expect, it } from 'vitest'
import { KanaEngine, RomanEngine } from './engine'
import type { Layout } from './engine'
import { sentencesByPassage } from '../content/sentences'
import {
  fingerFor,
  keyOutput,
  physicalKey,
  shiftFor,
  keyboardGeometry,
} from './physicalKeyboard'

it('finds physical keys for all canonical passage input in all supported layouts', () => {
  for (const layout of [
    'jis',
    'us',
    'dvorak',
    'colemak',
    'workman',
    'onishi',
    'azerty',
    'norman',
    'nova-f5-pair',
    'kana',
  ] as Layout[]) {
    const characters = new Set<string>()
    for (const sentences of Object.values(sentencesByPassage))
      for (const sentence of sentences) {
        const input =
          layout === 'kana'
            ? new KanaEngine(sentence.reading).target
            : new RomanEngine(sentence.reading).hint
        for (const char of input) characters.add(char)
      }
    for (const char of characters) {
      const key = physicalKey(char, layout)
      expect(key).toBeDefined()
      expect(
        keyOutput(key!.code, key!.shift, layout, char, key!.altGraph),
      ).toBe(char)
    }
  }
})
it('maps layout-specific punctuation, Dvorak and kana modifiers to physical keys', () => {
  expect(physicalKey('h', 'jis')).toEqual({ code: 'KeyH', shift: false })
  expect(physicalKey('h', 'dvorak')).toEqual({ code: 'KeyJ', shift: false })
  expect(physicalKey('[', 'jis')).toEqual({
    code: 'BracketRight',
    shift: false,
  })
  expect(physicalKey('[', 'us')).toEqual({ code: 'BracketLeft', shift: false })
  expect(physicalKey('。', 'kana')).toEqual({ code: 'Period', shift: true })
  expect(physicalKey('ゃ', 'kana')).toEqual({ code: 'Digit7', shift: true })
  expect(physicalKey('\u3099', 'kana')).toEqual({
    code: 'BracketLeft',
    shift: false,
  })
  expect(physicalKey(')', 'jis')).toEqual({ code: 'Digit9', shift: true })
  expect(shiftFor('Period')).toBe('ShiftLeft')
  expect(shiftFor('KeyZ')).toBe('ShiftRight')
  expect(fingerFor('KeyF')).toBe('left-index')
  expect(fingerFor('KeyJ')).toBe('right-index')
})
it('keeps all rows at a fixed physical pitch and includes staggered special keys', () => {
  for (const layout of [
    'jis',
    'us',
    'dvorak',
    'colemak',
    'workman',
    'onishi',
    'azerty',
    'norman',
    'nova-f5-pair',
    'kana',
  ] as Layout[]) {
    const slots = keyboardGeometry(layout)
    expect(
      slots.every((slot) => slot.column >= 1 && slot.column + slot.width <= 61),
    ).toBe(true)
    expect(slots.find((slot) => slot.code === 'KeyQ')?.column).toBe(7)
    expect(slots.find((slot) => slot.code === 'KeyA')?.column).toBe(8)
    expect(slots.find((slot) => slot.code === 'KeyZ')?.column).toBe(10)
    expect(slots.some((slot) => /^(Escape|F\d+)$/.test(slot.code))).toBe(false)
    expect(new Set(slots.map((slot) => slot.row))).toEqual(
      new Set([1, 2, 3, 4, 5]),
    )
    expect(
      new Set(
        slots
          .filter((slot) => slot.code.startsWith('Key'))
          .map((slot) => slot.width),
      ),
    ).toEqual(new Set([4]))
    expect(slots.find((slot) => slot.code === 'Enter')?.tall ?? false).toBe(
      ['jis', 'kana', 'azerty', 'nova-f5-pair'].includes(layout),
    )
  }
})

it('locates every printable US symbol on the two new layouts, including the grave key', () => {
  for (const layout of ['colemak', 'workman'] as const) {
    for (let code = 32; code < 127; code++) {
      const char = String.fromCharCode(code)
      if (/[A-Z]/.test(char)) continue // Latin input is case-insensitive.
      const key = physicalKey(char, layout)
      expect(key, `${layout}/${char}`).toBeDefined()
      expect(keyOutput(key!.code, key!.shift, layout)).toBe(char)
    }
    expect(physicalKey('`', layout)).toEqual({
      code: 'Backquote',
      shift: false,
    })
    expect(physicalKey('~', layout)).toEqual({ code: 'Backquote', shift: true })
  }
})
