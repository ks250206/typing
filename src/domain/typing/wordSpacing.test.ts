import { expect, it } from 'vitest'
import { RomanEngine } from './engine'
import { sentencesByPassage } from '../content/sentences'
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
      expect(
        starts.size,
        sentence.text + ' / ' + sentence.reading + ' / ' + [...words.reading],
      ).toBe(words.reading.size)
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

import { consumedOffsets } from './wordSpacing'
it('consumes only complete words and maps alternative n spelling to the right prefix', () => {
  const target = 'へいかんのほうそう。'
  const starts = new Set([4, 5])
  const model = new RomanEngine(target)
  for (const key of 'heika') model.feed(key)
  expect(
    consumedOffsets(target, model.position, 'heika', model.hint, starts, false),
  ).toEqual({ reading: 0, input: 0, roman: 0 })
  for (const key of 'nn') model.feed(key)
  expect(
    consumedOffsets(
      target,
      model.position,
      'heikann',
      model.hint,
      starts,
      false,
    ),
  ).toEqual({ reading: 4, input: 4, roman: 7 })
})
it('never consumes the kana word until a separate dakuten is complete', () => {
  const target = 'がの'.normalize('NFD')
  expect(consumedOffsets(target, 1, '', '', new Set([1]), false).input).toBe(0)
  expect(consumedOffsets(target, 2, '', '', new Set([1]), false)).toEqual({
    reading: 1,
    input: 2,
    roman: 0,
  })
})

it('keeps word colors when a TypeWell roman line cuts off partway through a syllable', () => {
  expect([
    ...romanWordStarts('あ しんぶん', 'a si', new Set([2]), true),
  ]).toEqual([2])
  expect([
    ...romanWordStarts('あ しんぶん', 'a s', new Set([2]), true),
  ]).toEqual([2])
  expect([
    ...romanWordStarts('あ しんぶん', 'a sh', new Set([2]), true),
  ]).toEqual([2])
  expect([
    ...romanWordStarts('あ しんぶん', 'a q', new Set([2]), true),
  ]).toEqual([])
})

it('consumes the typed prefix when the final roman syllable is clipped by a stroke limit', () => {
  expect(
    consumedOffsets('あ しんぶん', 2, 'a ', 's', new Set([2]), false, true),
  ).toEqual({ reading: 2, input: 2, roman: 2 })
})
