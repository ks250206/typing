import { afterEach, expect, it, vi } from 'vite-plus/test'
import {
  defaultSentencePracticeSettings,
  readSentencePracticeSettings,
  saveSentencePracticeSettings,
} from './sentencePractice'

afterEach(() => vi.unstubAllGlobals())
it('restores a valid English set and goals without persisting attempt results', () => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  })
  const config = {
    passageId: 'en-typewell-01',
    targetKpm: 250,
    maxMisses: 2,
    repetitions: 7,
  }
  saveSentencePracticeSettings(config)
  expect(readSentencePracticeSettings()).toEqual(config)
  expect(JSON.parse([...storage.values()][0])).toEqual(config)
})
it('falls back per field for stale IDs, malformed JSON, invalid types and blocked storage', () => {
  for (const raw of [
    'null',
    '[]',
    '{bad',
    '{"passageId":"deleted","targetKpm":0,"maxMisses":-2,"repetitions":"5"}',
  ]) {
    vi.stubGlobal('localStorage', { getItem: () => raw })
    expect(readSentencePracticeSettings()).toEqual(
      defaultSentencePracticeSettings,
    )
  }
  vi.stubGlobal('localStorage', {
    getItem: () =>
      '{"passageId":"en-library","targetKpm":200,"repetitions":51}',
  })
  expect(readSentencePracticeSettings()).toEqual({
    ...defaultSentencePracticeSettings,
    passageId: 'en-library',
    targetKpm: 200,
  })
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('blocked')
    },
  })
  expect(readSentencePracticeSettings()).toEqual(
    defaultSentencePracticeSettings,
  )
})
it('exposes write failures so the feature can notify and retain its in-memory settings', () => {
  vi.stubGlobal('localStorage', {
    setItem: () => {
      throw new Error('quota')
    },
  })
  expect(() =>
    saveSentencePracticeSettings(defaultSentencePracticeSettings),
  ).toThrow('quota')
})
