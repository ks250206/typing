import { afterEach, expect, it, vi } from 'vitest'
import { readSentenceStats, saveSentenceStats } from './sentenceStats'
afterEach(() => vi.unstubAllGlobals())
it('round-trips word statistics and filters malformed saved rows', () => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  })
  const key = '["en-library","jis","Hi.","Hi."]'
  const row = {
    best: 360,
    kpm: 180,
    elapsed: 1000,
    tries: 2,
    keys: 3,
    misses: 0,
  }
  saveSentenceStats({ [key]: row })
  expect(readSentenceStats()).toEqual({ [key]: row })
  storage.set(
    'galactype.sentence-stats.v1',
    JSON.stringify({
      [key]: row,
      '[broken]': { ...row, tries: -2 },
      'bad-key': row,
      '[fraction]': { ...row, keys: 0.5 },
    }),
  )
  expect(readSentenceStats()).toEqual({ [key]: row })
})
it('survives blocked or malformed storage and exposes write failures for notification', () => {
  for (const value of ['[]', 'null', '{bad']) {
    vi.stubGlobal('localStorage', { getItem: () => value })
    expect(readSentenceStats()).toEqual({})
  }
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw Error('blocked')
    },
    setItem: () => {
      throw Error('quota')
    },
  })
  expect(readSentenceStats()).toEqual({})
  expect(() => saveSentenceStats({})).toThrow('quota')
})
