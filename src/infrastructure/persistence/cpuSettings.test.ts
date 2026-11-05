import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test'
import { cpuPresets } from '../../domain/battle/cpuMatch'
import {
  CPU_CONFIG_STORAGE_KEY,
  CPU_PROMPTS_STORAGE_KEY,
  readCpuConfig,
  readCpuPromptSelection,
  saveCpuConfig,
  saveCpuPromptSelection,
} from './cpuSettings'

let store: Map<string, string>
beforeEach(() => {
  store = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  })
})
afterEach(() => vi.unstubAllGlobals())
const cat = cpuPresets.find((p) => p.name === 'ネコ')!

it('round trips a valid CPU configuration', () => {
  const config = { kpm: 432, reactionMs: 210, curve: 'constant' as const }
  saveCpuConfig(config)
  expect(JSON.parse(store.get(CPU_CONFIG_STORAGE_KEY)!)).toEqual(config)
  expect(readCpuConfig()).toEqual(config)
})

it('falls back to the cat preset for missing, corrupt or out-of-range settings', () => {
  expect(readCpuConfig()).toEqual(cat)
  for (const value of [
    '{',
    JSON.stringify({ kpm: 20, reactionMs: 200, curve: 'constant' }),
    JSON.stringify({ kpm: 300, reactionMs: 2000, curve: 'constant' }),
    JSON.stringify({ kpm: 300, reactionMs: 200, curve: 'linear' }),
  ]) {
    store.set(CPU_CONFIG_STORAGE_KEY, value)
    expect(readCpuConfig()).toEqual(cat)
  }
})

it('migrates an exact legacy preset to its current profile', () => {
  store.set(
    CPU_CONFIG_STORAGE_KEY,
    JSON.stringify({ kpm: 300, reactionMs: 210, curve: 'ease-in' }),
  )
  expect(readCpuConfig()).toEqual(cat)
})

it('round trips the prompt selection and keeps the raw word count for callers', () => {
  const selection = {
    id: 'cpu-rtc',
    seed: 'abc',
    fixed: true,
    wordsPerPrompt: 7,
  }
  saveCpuPromptSelection(selection)
  expect(JSON.parse(store.get(CPU_PROMPTS_STORAGE_KEY)!)).toEqual(selection)
  expect(readCpuPromptSelection()).toEqual(selection)
})

it('draws a fresh unfixed RTC selection for unknown sets or invalid seeds', () => {
  for (const saved of [
    { id: 'missing-set', seed: 'abc', fixed: true },
    { id: 'cpu-rtc', seed: '', fixed: true },
    { id: 'cpu-rtc', seed: 'x'.repeat(65), fixed: true },
  ]) {
    store.set(CPU_PROMPTS_STORAGE_KEY, JSON.stringify(saved))
    const selection = readCpuPromptSelection()
    expect(selection).toMatchObject({ id: 'cpu-rtc', fixed: false })
    expect(selection.seed).not.toBe(saved.seed)
  }
})

it('keeps playing when storage refuses writes', () => {
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('blocked')
    },
    setItem: () => {
      throw new Error('quota')
    },
  })
  expect(() => saveCpuConfig(cat)).not.toThrow()
  expect(readCpuConfig()).toEqual(cat)
  expect(readCpuPromptSelection().id).toBe('cpu-rtc')
})
