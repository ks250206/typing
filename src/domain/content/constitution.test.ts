import { expect, it } from 'vitest'
import { constitution } from './constitution'
import official from '../../../data/sources/constitution/preamble.json' with { type: 'json' }
import { sentencesByPassage } from './sentences'

it('includes all four preamble paragraphs exactly as published by the House of Representatives', () => {
  expect(constitution.paragraphs.map((p) => p.text)).toEqual(official)
  expect(constitution.paragraphs.map((p) => p.text.length)).toEqual([
    285, 206, 110, 42,
  ])
  expect(sentencesByPassage[constitution.id]).toHaveLength(9)
  expect(constitution.source?.url).toContain('shugiin.go.jp')
})
it('preserves the written historical kana and provides explicit modern input readings', () => {
  const all = constitution.paragraphs.flatMap((p) => p.segments ?? [])
  for (const [text, reading] of [
    ['わたつて', 'わたって'],
    ['やう', 'よう'],
    ['ゐる', 'いる'],
    ['思ふ', 'おもう'],
    ['いづれ', 'いずれ'],
    ['従ふ', 'したがう'],
    ['立たう', 'たとう'],
    ['誓ふ', 'ちかう'],
    ['免か', 'まぬか'],
  ])
    expect(all).toContainEqual({ text, reading })
})
