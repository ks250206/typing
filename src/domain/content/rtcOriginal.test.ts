import { expect, it } from 'vitest'
import { rtcOriginalDocument, rtcOriginalPrompts } from './rtcOriginal'
import { practiceDocument, practicePassages } from './practiceDocument'
import { seededBattlePrompts } from './battleSets'
import { legacyBattlePrompts } from './battlePrompts'
import { KanaEngine, RomanEngine } from '../typing/engine'
import { sentenceWordStarts, romanWordStarts } from '../typing/wordSpacing'

it('shares 200 unique authored prompts and samples 15 without replacement for practice', () => {
  expect(rtcOriginalPrompts).toHaveLength(200)
  expect(new Set(rtcOriginalPrompts.map((s) => s.text)).size).toBe(200)
  expect(practicePassages.find((p) => p.id === 'cpu-rtc')?.title).toBe(
    'RTCオリジナル',
  )
  const a = rtcOriginalDocument('sample')
  expect(a.sentences).toHaveLength(15)
  expect(new Set(a.sentences.map((s) => s.text)).size).toBe(15)
  expect(a).toEqual(practiceDocument('cpu-rtc', 'sample', 'jis', 1))
  expect(a).not.toEqual(rtcOriginalDocument('different'))
  for (const s of [...a.sentences, ...seededBattlePrompts('cpu-rtc', 'sample')])
    expect(rtcOriginalPrompts).toContainEqual(s)
})

it.each(rtcOriginalPrompts)(
  'preserves readings and word boundaries: $text',
  (sentence) => {
    expect(sentence.segments.map((s) => s.text).join('')).toBe(sentence.text)
    expect(sentence.segments.map((s) => s.reading).join('')).toBe(
      sentence.reading,
    )
    const offsets = new Set<number>()
    let offset = 0
    for (const segment of sentence.segments) {
      offsets.add(offset)
      offset += segment.text.length
    }
    for (const word of new Intl.Segmenter('ja', {
      granularity: 'word',
    }).segment(sentence.text))
      if (word.isWordLike)
        expect(offsets.has(word.index), word.segment).toBe(true)
    const words = sentenceWordStarts(sentence)
    const roman = new RomanEngine(sentence.reading)
    expect(
      romanWordStarts(sentence.reading, roman.hint, words.reading).size,
    ).toBe(words.reading.size)
    for (const engine of [roman, new KanaEngine(sentence.reading)]) {
      for (const key of engine instanceof KanaEngine
        ? engine.target
        : engine.hint)
        expect(engine.feed(key)).toBe(true)
      expect(engine.done).toBe(true)
    }
  },
)

it('retains the old 20-prompt corpus and shuffle algorithm for existing CPU records', () => {
  const legacy = seededBattlePrompts('cpu-rtc', 'legacy', 1)
  expect(new Set(legacy.map((s) => s.text))).toEqual(
    new Set(legacyBattlePrompts.map((s) => s.text)),
  )
  expect(legacyBattlePrompts).toHaveLength(20)
  expect(legacy).toEqual(seededBattlePrompts('cpu-rtc', 'legacy', 1))
  expect(legacy).not.toEqual(seededBattlePrompts('cpu-rtc', 'legacy', 2))
})
