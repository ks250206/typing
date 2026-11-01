import { normalizeCpuWordsPerPrompt } from '../battle/cpuPromptSettings'
import { rtcPassages } from './rtcWords'
import { expect, it } from 'vitest'
import { battleSets, seededBattlePrompts } from './battleSets'
import { etypingPassages } from './etyping'
import { passages } from './passages'
import { englishPassages } from './english'
import { typewellPassages } from './typewell'
import { sentencesByPassage } from './sentences'
it('offers every registered set plus the original RTC set', () => {
  expect(battleSets.map((s) => s.id)).toEqual([
    'cpu-rtc',
    ...passages.map((p) => p.id),
    ...typewellPassages.map((p) => p.id),
    ...rtcPassages.map((p) => p.id),
    ...englishPassages.map((p) => p.id),
  ])
})
it.each(battleSets)(
  'fixes seeded BO7 order without changing the source: $id',
  (set) => {
    const original =
      set.language === 'en'
        ? englishPassages.find((p) => p.id === set.id)
        : sentencesByPassage[set.id]
    const before = JSON.stringify(original)
    const prompts = seededBattlePrompts(set.id, 'replay')
    expect(prompts).toHaveLength(133)
    expect(prompts).toEqual(seededBattlePrompts(set.id, 'replay'))
    if (new Set(prompts.map((prompt) => prompt.text)).size > 1)
      expect(prompts).not.toEqual(seededBattlePrompts(set.id, 'other'))
    expect(JSON.stringify(original)).toBe(before)
  },
)
it('uses supplied XML sentences and preserves individual words for v1 TypeWell records', () => {
  for (const set of etypingPassages)
    for (const s of seededBattlePrompts(set.id, 'seed'))
      expect(sentencesByPassage[set.id]).toContainEqual(s)
  const words = seededBattlePrompts('typewell-space', 'seed', 1)
  expect(
    words.every((s) => s.segments.length === 1 && !s.text.includes(' ')),
  ).toBe(true)
})

it.each([
  'typewell-basic',
  'typewell-space',
  'en-typewell-01',
  'en-typewell-04',
])(
  'groups five dictionary entries and spaces in v2 while retaining v1: %s',
  (id) => {
    const old = seededBattlePrompts(id, 'five-words', 1)
    const grouped = seededBattlePrompts(id, 'five-words', 2)
    expect(grouped[0].text).toBe(
      old
        .slice(0, 5)
        .map((word) => word.text)
        .join(' '),
    )
    expect(grouped[0].reading).toBe(
      old
        .slice(0, 5)
        .map((word) => word.reading)
        .join(' '),
    )
    expect(grouped[0].segments.map((part) => part.text).join('')).toBe(
      grouped[0].text,
    )
    expect(grouped[0].segments.map((part) => part.reading).join('')).toBe(
      grouped[0].reading,
    )
    expect(grouped).toHaveLength(133)
  },
)

it('validates configurable TypeWell group sizes and leaves other CPU sets unchanged', () => {
  for (const value of [undefined, null, NaN, 0, -1, 51, 1.5, '3'])
    expect(normalizeCpuWordsPerPrompt(value)).toBe(5)
  for (const count of [1, 3, 10, 50]) {
    for (const id of ['typewell-basic', 'en-typewell-01']) {
      const old = seededBattlePrompts(id, 'variable-size', 1)
      const prompts = seededBattlePrompts(id, 'variable-size', 2, count)
      expect(prompts).toHaveLength(133)
      expect(prompts[0].text).toBe(
        old
          .slice(0, count)
          .map((word) => word.text)
          .join(' '),
      )
      expect(seededBattlePrompts(id, 'variable-size', 1, count)).toEqual(old)
    }
  }
  expect(seededBattlePrompts('en-library', 'size', 2, 1)).toEqual(
    seededBattlePrompts('en-library', 'size', 2, 10),
  )
})
