import { rtcPassages } from './rtcWords'
import { expect, it } from 'vitest'
import { battleSets, seededBattlePrompts } from './battleSets'
import { etypingPassages } from './etyping'
import { passages } from './passages'
import { typewellPassages } from './typewell'
import { sentencesByPassage } from './sentences'
it('offers every registered set plus the original RTC set', () => {
  expect(battleSets.map((s) => s.id)).toEqual([
    'cpu-rtc',
    ...passages.map((p) => p.id),
    ...typewellPassages.map((p) => p.id),
    ...rtcPassages.map((p) => p.id),
  ])
})
it('fixes the complete BO7 prompt order from seed, changes with another seed and preserves corpus order', () => {
  for (const set of battleSets) {
    const before = JSON.stringify(sentencesByPassage[set.id])
    const a = seededBattlePrompts(set.id, 'replay')
    expect(a).toHaveLength(133)
    expect(a).toEqual(seededBattlePrompts(set.id, 'replay'))
    expect(a).not.toEqual(seededBattlePrompts(set.id, 'other'))
    expect(JSON.stringify(sentencesByPassage[set.id])).toBe(before)
  }
})
it('uses supplied XML sentences and individual TypeWell words in RTC', () => {
  for (const set of etypingPassages)
    for (const s of seededBattlePrompts(set.id, 'seed'))
      expect(sentencesByPassage[set.id]).toContainEqual(s)
  const words = seededBattlePrompts('typewell-space', 'seed')
  expect(
    words.every((s) => s.segments.length === 1 && !s.text.includes(' ')),
  ).toBe(true)
})
