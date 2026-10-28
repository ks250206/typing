import { expect, it } from 'vitest'
import { randomSentenceIndex, sakusaku, sakusakuEntries } from './sakusaku'
import { sentencesByPassage } from './sentences'

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
