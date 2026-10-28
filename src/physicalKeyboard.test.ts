import { expect, it } from 'vitest'
import { KanaEngine, RomanEngine } from './engine'
import type { Layout } from './engine'
import { sentencesByPassage } from './sentences'
import {
  fingerFor,
  keyOutput,
  physicalKey,
  shiftFor,
  wordHint,
} from './physicalKeyboard'

it('finds physical keys for all canonical passage input in all four layouts', () => {
  for (const layout of ['jis', 'us', 'dvorak', 'kana'] as Layout[]) {
    for (const sentences of Object.values(sentencesByPassage))
      for (const sentence of sentences) {
        const input =
          layout === 'kana'
            ? new KanaEngine(sentence.reading).target
            : new RomanEngine(sentence.reading).hint
        for (const char of input) {
          const key = physicalKey(char, layout)
          expect(key, `${layout}: ${char}`).toBeDefined()
          expect(keyOutput(key!.code, key!.shift, layout)).toBe(char)
        }
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
it('keeps the word preview aligned across alternative spelling and half-entered dakuten', () => {
  const sentence = sentencesByPassage['night-library'][0]
  const engine = new RomanEngine(sentence.reading)
  expect(wordHint(sentence, 'jis', 0, '', engine.hint)).toBe('heikan')
  for (const key of 'heikann') engine.feed(key)
  expect(
    wordHint(sentence, 'jis', engine.position, 'heikann', engine.hint),
  ).toBe('no')
  const kana = new KanaEngine(sentence.reading)
  const position = kana.target.indexOf('か\u3099') + 1
  expect(
    wordHint(sentence, 'kana', position, '', kana.target.slice(position)),
  ).toBe('\u3099')
})
