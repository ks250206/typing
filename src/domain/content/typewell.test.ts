import themes from '../../data/generated/themes.json' with { type: 'json' }
import { expect, it } from 'vitest'
import classicData from '../../data/generated/typewell.json' with { type: 'json' }
import { KanaEngine, RomanEngine } from '../typing/engine'
import {
  strokeLimit,
  seededRandom,
  typewellDocument,
  typewellSets,
  planTypewell,
  typewellEngine,
} from './typewell'

const data = { ...classicData, ...themes.words }
it('aggregates all 17 pages into exactly four complete datasets', () => {
  expect(
    typewellSets
      .filter(
        (s) =>
          s.category !== 'space' &&
          s.category !== 'scientists' &&
          s.category !== 'sf' &&
          s.category !== 'sports',
      )
      .map((s) => [s.pages, data[s.category].length]),
  ).toEqual([
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
it('fixes the 400-key reference before typing and ends in the middle of the final word', () => {
  const sentence = {
    text: 'あ'.repeat(398) + '参加 ',
    reading: 'あ'.repeat(398) + 'さんか ',
    segments: [
      { text: 'あ'.repeat(398), reading: 'あ'.repeat(398) },
      { text: '参加', reading: 'さんか' },
      { text: ' ', reading: ' ' },
    ],
  }
  const plan = planTypewell(sentence, 'jis')
  expect(plan.reference).toBe('a'.repeat(398) + 'sa')
  const engine = typewellEngine(plan)
  for (const char of plan.reference.slice(0, 399))
    expect(engine.feed(char)).toBe(true)
  expect(engine.done).toBe(false)
  expect(engine.hint).toBe('a')
  engine.feed('a')
  expect(engine.done).toBe(true)
  expect(plan.sentence).toBe(sentence)
  expect(plan.reference).toHaveLength(400)
})
it('different input spellings share one predetermined reference and endpoint', () => {
  const sentence = {
    text: '参加 '.repeat(100),
    reading: 'さんか '.repeat(100),
    segments: [{ text: '参加 '.repeat(100), reading: 'さんか '.repeat(100) }],
  }
  const plan = planTypewell(sentence, 'jis')
  const run = (input: string) => {
    const engine = typewellEngine(plan)
    let typed = ''
    for (const char of input) {
      if (engine.done) break
      expect(engine.feed(char)).toBe(true)
      typed += char
    }
    expect(engine.done).toBe(true)
    expect(engine.position).toBe(266)
    return typed
  }
  const normal = run('sanka '.repeat(100))
  const redundant = run('sannka '.repeat(100))
  expect(normal.length).toBe(400)
  expect(redundant.length).toBeGreaterThan(400)
  expect(plan.reference).toBe(normal)
  expect(plan.reference).toHaveLength(400)
})
it('plans exactly 400 reference keys or 280 separate kana strokes for every set and seed', () => {
  for (const set of typewellSets)
    for (const layout of ['jis', 'kana'] as const)
      for (const seed of ['1', '2', '再現']) {
        const doc = typewellDocument(set.id, seed, layout)
        expect(doc.plan.reference).toHaveLength(strokeLimit(layout))
        expect(doc.sentences[0].reading.length).toBeLessThan(450)
        const fixed = JSON.stringify(doc)
        const engine = typewellEngine(doc.plan)
        for (const char of doc.plan.reference.slice(0, -1))
          expect(engine.feed(char)).toBe(true)
        expect(engine.done).toBe(false)
        expect(engine.feed(doc.plan.reference.at(-1)!)).toBe(true)
        expect(engine.done).toBe(true)
        expect(JSON.stringify(doc)).toBe(fixed)
      }
})
it('retains the original 64-word pool for version 1 seeded history replay', () => {
  const doc = typewellDocument('typewell-space', 'galactype', 'jis', 1)
  expect(doc.plan.reference).toHaveLength(400)
  expect(doc.passage.subtitle).toContain('64語の旧v1')
  for (const { text } of doc.sentences[0].segments.filter(
    (s) => s.text !== ' ',
  ))
    expect(legacySpaceWords.some(([word]) => word === text)).toBe(true)
})

import { legacySpaceWords, spaceWordGroups, spaceWords } from './spaceWords'
it('ships 583 distinct celestial names with playable roman/kana readings', () => {
  expect(Object.values(spaceWordGroups).map((group) => group.length)).toEqual([
    453, 8, 10, 16, 8, 88,
  ])
  expect(new Set(spaceWords.map(([text]) => text)).size).toBe(583)
  for (const [text, reading] of spaceWords) {
    const roman = new RomanEngine(reading, true)
    for (const key of roman.hint) expect(roman.feed(key), text).toBe(true)
    expect(roman.done, text).toBe(true)
    const kana = new KanaEngine(reading)
    for (const key of kana.target) expect(kana.feed(key), text).toBe(true)
    expect(kana.done, text).toBe(true)
  }
  const source = typewellDocument('typewell-space', 'galaxy').sentences[0]
  expect(source.text).toContain(' ')
  for (const segment of source.segments.filter((s) => s.text !== ' '))
    expect(
      spaceWords.some(
        ([text, reading]) =>
          text === segment.text && reading === segment.reading,
      ),
    ).toBe(true)
})

it('replays v1 reference keys exactly using the old generation algorithm and corpus', () => {
  for (const set of typewellSets)
    for (const layout of ['jis', 'kana'] as const) {
      const pool =
        set.category === 'space' ? legacySpaceWords : data[set.category]
      const random = seededRandom(`${set.id}/v1/replay`)
      const words: string[] = []
      let length = 0
      while (length < 1000) {
        const [, reading] = pool[Math.floor(random() * pool.length)]
        if (words.length) length++
        words.push(reading)
        length += reading.length
      }
      const source = words.join(' ')
      const old =
        layout === 'kana'
          ? new KanaEngine(source).target
          : new RomanEngine(source, true).hint
      expect(typewellDocument(set.id, 'replay', layout, 1).plan.reference).toBe(
        old.slice(0, strokeLimit(layout)),
      )
    }
})
