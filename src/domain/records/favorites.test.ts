import { expect, it } from 'vitest'
import { favoriteKey, reorderFavorites, type Favorite } from './favorites'

const items: Favorite[] = [
  { kind: 'practice', passageId: 'etyping-spring', layout: 'jis' },
  {
    kind: 'cpu',
    passageId: 'cpu-rtc',
    layout: 'kana',
    cpuConfig: { kpm: 385, reactionMs: 205, curve: 'ease-in' },
  },
  { kind: 'practice', passageId: 'night-library', layout: 'colemak' },
]
it('reorders whole entries without changing CPU settings, layouts or the source list', () => {
  const before = JSON.stringify(items)
  const order = [items[2], items[0], items[1]].map(favoriteKey)
  const reordered = reorderFavorites(items, order)
  expect(reordered).toEqual([items[2], items[0], items[1]])
  expect(reordered[2]).toBe(items[1])
  expect(JSON.stringify(items)).toBe(before)
})
it('rejects incomplete, duplicated, stale and unknown drag orders without losing entries', () => {
  const keys = items.map(favoriteKey)
  for (const order of [
    keys.slice(1),
    [...keys, 'missing'],
    [keys[0], keys[0], keys[2]],
    [keys[0], keys[1], 'missing'],
  ]) {
    expect(reorderFavorites(items, order)).toBe(items)
  }
  expect(reorderFavorites(items, keys)).toBe(items)
})
