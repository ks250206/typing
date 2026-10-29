import { expect, it } from 'vitest'
import { RomanEngine } from './engine'
import { battlePrompts } from '../content/battlePrompts'
import { duelProjection } from './duelRoman'

it('preserves every CPU character offset on the same canonical spelling', () => {
  for (const sentence of battlePrompts) {
    const full = new RomanEngine(sentence.reading).hint
    const project = duelProjection(sentence.reading, full)
    for (let keys = 0; keys <= full.length; keys++)
      expect(project(keys, false), `${full}/${keys}`).toBe(keys)
  }
})
it('projects CPU progress onto the exact longer or shorter spelling shown to the player', () => {
  const doubled = duelProjection('さんか', 'sannka')
  expect(doubled(0, false)).toBe(0)
  expect(doubled(3, false)).toBe(4)
  expect(doubled(5, false)).toBe(6)
  const short = duelProjection('し', 'si')
  expect(short(0, false)).toBe(0)
  expect(short(2, false)).toBe(1)
  expect(short(3, false)).toBe(2)
})
it('maps separate kana voicing and small-kana strokes to one shared roman display', () => {
  const project = duelProjection('がきゃ', 'gakya')
  expect([0, 1, 2, 3, 4].map((keys) => project(keys, true))).toEqual([
    0, 1, 2, 3, 5,
  ])
})
it('supports the player guide changing to alternative spellings mid-input', () => {
  const sentence = battlePrompts.find((s) => s.reading.includes('し'))!
  const full = new RomanEngine(sentence.reading).hint
  const alternate = full.replace('shi', 'si')
  const engine = new RomanEngine(sentence.reading)
  let typed = ''
  for (const key of alternate) {
    typed += key
    expect(engine.feed(key)).toBe(true)
    expect(() =>
      duelProjection(sentence.reading, typed + engine.hint),
    ).not.toThrow()
  }
  const project = duelProjection(sentence.reading, alternate)
  const positions = Array.from({ length: full.length + 1 }, (_, i) =>
    project(i, false),
  )
  expect(positions.at(-1)).toBe(alternate.length)
  expect(
    positions.every((position, i) => i === 0 || position >= positions[i - 1]),
  ).toBe(true)
})
