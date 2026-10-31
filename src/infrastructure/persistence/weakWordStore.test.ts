import { beforeEach, expect, it, vi } from 'vitest'
import { dismissWeakWords, readWeakDismissals } from './weakWordStore'
import type { WeakWord } from '../../domain/records/weakWords'
let data: Map<string, string>
beforeEach(() => {
  data = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  })
})
const word = (i: number): WeakWord => ({
  id: `word-${i}`,
  text: '銀河',
  reading: 'ぎんが',
  segments: [{ text: '銀河', reading: 'ぎんが' }],
  misses: 1,
  loss: 0,
  attempts: 1,
  source: 'old',
})
it('persists deletion without changing source logs, bounds markers at 100 and releases stale revisions', () => {
  const words = Array.from({ length: 125 }, (_, i) => word(i))
  expect(Object.keys(dismissWeakWords(words, words)!)).toHaveLength(100)
  expect(readWeakDismissals()['word-0']).toBe('old')
  const changed = { ...word(0), source: 'new' }
  expect(dismissWeakWords([], [changed])).toEqual({})
})
it('reports unavailable storage without claiming deletion succeeded', () => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {
      throw Error('quota')
    },
  })
  expect(dismissWeakWords([word(0)], [word(0)])).toBeNull()
})
