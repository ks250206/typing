import { expect, it } from 'vitest'
import {
  createTrainerOrder,
  randomSentenceIndex,
  sakusaku,
  sakusakuEntries,
} from './sakusaku'
import { sentencesByPassage } from './sentences'
import source from '../data/sources/trainers/sakusaku-trainer.json'

it('retains the supplied 15 sentences in preview order without serial numbers or added punctuation', () => {
  const sentences = sentencesByPassage[sakusaku.id]
  expect(sentences).toHaveLength(15)
  expect(sentences.map((s) => [s.text, s.reading])).toEqual(
    sakusakuEntries.map(([text, reading]) => [text, reading]),
  )
  expect(sentences[8].text).toContain('水晶のほう')
  expect(sentences[10].text).toContain('科学')
  expect(sentences[12].text).toMatch(/提出すること$/u)
  expect(sakusaku.durationMs).toBe(60_000)
  expect(sakusakuEntries).toEqual(source.entries)
  for (const sentence of sentences) {
    expect(sentence.segments.map((s) => s.text).join('')).toBe(sentence.text)
    expect(sentence.segments.map((s) => s.reading).join('')).toBe(
      sentence.reading,
    )
  }
})
it('random selection covers every sentence and excludes the immediately previous one', () => {
  const length = 15
  expect(
    Array.from({ length }, (_, i) =>
      randomSentenceIndex(length, -1, () => (i + 0.5) / length),
    ),
  ).toEqual(Array.from({ length }, (_, i) => i))
  for (let previous = 0; previous < length; previous++) {
    const choices = Array.from({ length: length - 1 }, (_, i) =>
      randomSentenceIndex(length, previous, () => (i + 0.5) / (length - 1)),
    )
    expect(new Set(choices).size).toBe(length - 1)
    expect(choices).not.toContain(previous)
  }
  expect(randomSentenceIndex(1, 0)).toBe(0)
})

it('reproduces an unbounded seeded trainer order with no adjacent repeats', () => {
  const sequence = (seed: string) => {
    const next = createTrainerOrder(seed)
    return Array.from({ length: 1000 }, () => next())
  }
  const first = sequence('trainer-seed')
  expect(first).toEqual(sequence('trainer-seed'))
  expect(first).not.toEqual(sequence('different'))
  expect(new Set(first).size).toBe(15)
  expect(
    first.every((n, i) => n >= 0 && n < 15 && (!i || n !== first[i - 1])),
  ).toBe(true)
  const one = createTrainerOrder('one', 1)
  expect([one(), one()]).toEqual([0, 0])
})

it('shuffles a complete fresh lap indefinitely, with no omissions or repeated lap order', () => {
  for (const length of [15, 18]) {
    const next = createTrainerOrder('fast-typist', length)
    let previous: number[] = []
    for (let lap = 0; lap < 100; lap++) {
      const current = Array.from({ length }, () => next())
      expect([...current].sort((a, b) => a - b)).toEqual(
        Array.from({ length }, (_, i) => i),
      )
      if (lap) {
        expect(current).not.toEqual(previous)
        expect(current[0]).not.toBe(previous.at(-1))
      }
      previous = current
    }
  }
})
