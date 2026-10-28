import { expect, it } from 'vitest'
import data from './data/typewell.json' with { type: 'json' }
import { KanaEngine, RomanEngine } from './engine'
import {
  strokeLimit,
  typewellDocument,
  typewellSets,
  typewellView,
} from './typewell'

it('aggregates all 17 pages into exactly four complete datasets', () => {
  expect(typewellSets.map((s) => [s.pages, data[s.category].length])).toEqual([
    [3, 2154],
    [6, 3170],
    [4, 3330],
    [4, 2074],
  ])
  for (const pool of Object.values(data))
    for (const [text, reading] of pool) {
      expect(text.length).toBeGreaterThan(0)
      const engine = new RomanEngine(reading, true)
      expect(() => engine.hint, `${text}/${reading}`).not.toThrow()
      const hint = engine.hint
      for (const char of hint)
        expect(engine.feed(char), `${text}/${char}`).toBe(true)
      expect(engine.done, text).toBe(true)
    }
})
it('reproduces a category and seed, with a changed seed producing a different stream', () => {
  for (const { id } of typewellSets) {
    expect(typewellDocument(id, '星空')).toEqual(typewellDocument(id, '星空'))
    expect(typewellDocument(id, '1').sentences[0].text).not.toBe(
      typewellDocument(id, '2').sentences[0].text,
    )
  }
})
it('counts redundant n, shi and explicit small-kana as extra input, not natural progress', () => {
  for (const [reading, short, long, count] of [
    ['さんか', 'sanka', 'sannka', 5],
    ['し', 'si', 'shi', 2],
    ['しゃ', 'sya', 'shixya', 3],
    ['っさ', 'ssa', 'xtusa', 3],
  ] as const) {
    for (const spelling of [short, long]) {
      const engine = new RomanEngine(reading, true)
      for (const char of spelling) expect(engine.feed(char)).toBe(true)
      expect(engine.done).toBe(true)
      expect(engine.naturalProgress).toBe(count)
    }
  }
})
it('supports 399 / 400 natural strokes and an unfinished final word; kana ends at 280', () => {
  const sentence = {
    text: 'あ'.repeat(398) + '参加',
    reading: 'あ'.repeat(398) + 'さんか',
    segments: [
      { text: 'あ'.repeat(398), reading: 'あ'.repeat(398) },
      { text: '参加', reading: 'さんか' },
    ],
  }
  const engine = new RomanEngine(sentence.reading, true)
  for (const char of 'a'.repeat(398) + 's') engine.feed(char)
  expect(engine.naturalProgress).toBe(399)
  const view = typewellView(
    sentence,
    'a'.repeat(398) + 's',
    engine.hint,
    'jis',
    engine.naturalProgress,
  )
  expect(view.hint).toBe('a')
  engine.feed('a')
  expect(engine.naturalProgress).toBe(400)
  expect(engine.done).toBe(false)
  expect(strokeLimit('kana')).toBe(280)
  const kana = new KanaEngine('が'.repeat(200))
  for (const char of kana.target.slice(0, 280)) kana.feed(char)
  expect(kana.position).toBe(280)
  expect(kana.done).toBe(false)
})

it('a redundant-n session needs more physical keys but still ends at exactly 400 natural strokes', () => {
  const engine = new RomanEngine('さんか '.repeat(100), true)
  let actual = 0
  for (const char of 'sannka '.repeat(100)) {
    expect(engine.feed(char)).toBe(true)
    actual++
    if (engine.naturalProgress >= 400) break
  }
  expect(actual).toBeGreaterThan(400)
  expect(engine.naturalProgress).toBe(400)
  expect(engine.done).toBe(false)
})
