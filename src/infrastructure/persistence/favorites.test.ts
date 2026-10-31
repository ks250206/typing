import { afterEach, expect, it, vi } from 'vitest'
import {
  FAVORITES_STORAGE_KEY,
  readFavorites,
  saveFavorites,
} from './favorites'
import { favoriteKey, type Favorite } from '../../domain/records/favorites'

afterEach(() => vi.unstubAllGlobals())
const practice: Favorite = {
  kind: 'practice',
  passageId: 'cpu-rtc',
  layout: 'jis',
}
const cpu: Favorite = {
  kind: 'cpu',
  passageId: 'cpu-rtc',
  layout: 'kana',
  cpuConfig: { kpm: 385, reactionMs: 205, curve: 'ease-in' },
}

it('round trips both kinds, distinguishes CPU settings, deduplicates and discards saved seeds', () => {
  let saved = ''
  vi.stubGlobal('localStorage', {
    setItem: (key: string, value: string) => {
      expect(key).toBe(FAVORITES_STORAGE_KEY)
      saved = value
    },
    getItem: () => saved,
  })
  expect(saveFavorites([practice, cpu])).toBe(true)
  expect(readFavorites()).toEqual([practice, cpu])
  saved = JSON.stringify([
    { ...practice, seed: 'fixed', fixed: true },
    cpu,
    practice,
  ])
  expect(readFavorites()).toEqual([practice, cpu])
  expect(favoriteKey(cpu)).not.toBe(
    favoriteKey({ ...cpu, cpuConfig: { ...cpu.cpuConfig, kpm: 400 } }),
  )
})

it('ignores malformed entries individually and survives blocked storage', () => {
  vi.stubGlobal('localStorage', {
    getItem: () =>
      JSON.stringify([
        null,
        {},
        { ...practice, layout: '__proto__' },
        { ...practice, passageId: 'missing' },
        { ...cpu, cpuConfig: { ...cpu.cpuConfig, kpm: 0 } },
        { ...cpu, cpuConfig: { ...cpu.cpuConfig, reactionMs: 2000 } },
        practice,
      ]),
  })
  expect(readFavorites()).toEqual([practice])
  vi.stubGlobal('localStorage', { getItem: () => '{bad' })
  expect(readFavorites()).toEqual([])
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('blocked')
    },
    setItem: () => {
      throw new Error('blocked')
    },
  })
  expect(readFavorites()).toEqual([])
  expect(saveFavorites([practice])).toBe(false)
})

it('preserves a user-defined mixed favorite order across saving and reading', () => {
  let saved = ''
  vi.stubGlobal('localStorage', {
    setItem: (_key: string, value: string) => {
      saved = value
    },
    getItem: () => saved,
  })
  const order = [cpu, practice]
  expect(saveFavorites(order)).toBe(true)
  expect(readFavorites()).toEqual(order)
})
