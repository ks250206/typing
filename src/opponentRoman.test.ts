import { expect, it } from 'vitest'
import { opponentRoman } from './opponentRoman'
it('splits the exact canonical CPU plan at its accepted keystroke count', () => {
  expect(opponentRoman('さんか', 0, false)).toEqual({
    typed: '',
    remaining: 'sanka',
  })
  expect(opponentRoman('さんか', 3, false)).toEqual({
    typed: 'san',
    remaining: 'ka',
  })
  expect(opponentRoman('さんか', 5, false)).toEqual({
    typed: 'sanka',
    remaining: '',
  })
})
it('holds voiced and compound kana until their complete CPU kana strokes are entered', () => {
  expect(opponentRoman('がきゃ', 1, true).typed).toBe('')
  expect(opponentRoman('がきゃ', 2, true).typed).toBe('ga')
  expect(opponentRoman('がきゃ', 3, true).typed).toBe('ga')
  expect(opponentRoman('がきゃ', 4, true).typed).toBe('gakya')
})
