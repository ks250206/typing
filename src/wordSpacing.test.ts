import { expect, it } from 'vitest'
import { RomanEngine } from './engine'
import { sentencesByPassage } from './sentences'
import { romanWordStarts, sentenceWordStarts } from './wordSpacing'

it('maps Japanese word starts to exact reviewed readings for every passage', () => {
  for (const sentences of Object.values(sentencesByPassage)) {
    for (const sentence of sentences) {
      const words = sentenceWordStarts(sentence)
      let offset = 0
      sentence.segments.forEach((segment, index) => {
        expect(words.reading.has(offset)).toBe(words.segments.has(index))
        offset += segment.reading.length
      })
      const roman = new RomanEngine(sentence.reading).hint
      const starts = romanWordStarts(sentence.reading, roman, words.reading)
      expect(starts.size).toBe(words.reading.size)
      const engine = new RomanEngine(sentence.reading)
      for (let index = 0; index < roman.length; index++) {
        if (starts.has(index))
          expect(words.reading.has(engine.position)).toBe(true)
        expect(engine.feed(roman[index])).toBe(true)
      }
      expect(engine.done).toBe(true)
    }
  }
})

it('keeps full alternative spellings together at a word boundary', () => {
  const boundaries = new Set([4])
  expect([...romanWordStarts('へいかんの', 'heikanno', boundaries)]).toEqual([
    6,
  ])
  expect([...romanWordStarts('へいかんの', 'heikannno', boundaries)]).toEqual([
    7,
  ])
  expect([...romanWordStarts('へいかんの', "heikan'no", boundaries)]).toEqual([
    7,
  ])
  expect([
    ...romanWordStarts('しつもんです', 'shitsumondesu', new Set([4])),
  ]).toEqual([9])
  expect([
    ...romanWordStarts('しつもんです', 'situmonndesu', new Set([4])),
  ]).toEqual([8])
})
