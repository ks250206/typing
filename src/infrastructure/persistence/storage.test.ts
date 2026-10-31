import { beforeEach, expect, it, vi } from 'vitest'
import { readHistory, readSettings, saveHistory, saveSettings } from './storage'
let data: Map<string, string>
beforeEach(() => {
  data = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
  })
})
it('survives corrupt data and null settings', () => {
  data.set('yohaku.history.v1', '{')
  data.set('yohaku.settings.v1', 'null')
  expect(readHistory()).toEqual([])
  expect(readSettings().layout).toBe('jis')
})
it('round trips settings and rejects unknown layouts', () => {
  expect(
    saveSettings({
      layout: 'dvorak',
      background: false,
      wordColors: true,
      consumeTyped: true,
      navigationMotion: 'system',
    }),
  ).toBe(true)
  expect(readSettings()).toEqual({
    layout: 'dvorak',
    background: false,
    wordColors: true,
    consumeTyped: true,
    navigationMotion: 'system',
  })
  data.set('yohaku.settings.v1', '{"layout":"bad"}')
  expect(readSettings().layout).toBe('jis')
})
it('rejects malformed history entries', () => {
  data.set('yohaku.history.v1', '[null,{},1]')
  expect(readHistory()).toEqual([])
})
it('reports unavailable storage without crashing', () => {
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw Error()
    },
    setItem: () => {
      throw Error()
    },
  })
  expect(readHistory()).toEqual([])
  expect(saveHistory([])).toBe(false)
})

import { appendHistory, clearHistory, subscribeHistory } from './storage'
import type { RecordEntry } from '../../domain/records/types'
const record = (id: string): RecordEntry => ({
  id,
  passageId: 'night-library',
  title: '夜更けの図書室',
  layout: 'jis',
  date: '2026-10-25T00:00:00Z',
  elapsed: 60000,
  keys: 100,
  misses: 0,
  kpm: 100,
  accuracy: 100,
})
it('appends against current storage instead of a stale tab snapshot', async () => {
  await appendHistory(record('a'))
  const result = await appendHistory(record('b'))
  expect(result.saved).toBe(true)
  expect(new Set(readHistory().map((r) => r.id))).toEqual(new Set(['a', 'b']))
})
it('serializes concurrent appends and deletion under the same lock', async () => {
  let queue: Promise<unknown> = Promise.resolve()
  const request = vi.fn((_name: string, operation: () => unknown) => {
    const next = queue.then(operation)
    queue = next
    return next
  })
  vi.stubGlobal('navigator', { locks: { request } })
  await Promise.all([appendHistory(record('a')), appendHistory(record('b'))])
  expect(readHistory()).toHaveLength(2)
  await Promise.all([clearHistory(), appendHistory(record('c'))])
  expect(readHistory().map((r) => r.id)).toEqual(['c'])
  expect(new Set(request.mock.calls.map(([name]) => name))).toEqual(
    new Set(['yohaku.history.v1']),
  )
  vi.unstubAllGlobals()
})
it('retains unsaved records on the next append without resurrecting deleted records', async () => {
  await appendHistory(record('old'))
  await clearHistory()
  await appendHistory(record('new'), [record('unsaved')])
  expect(new Set(readHistory().map((r) => r.id))).toEqual(
    new Set(['new', 'unsaved']),
  )
})
it('subscribes to history changes and storage clears from other tabs', () => {
  const target = new EventTarget()
  vi.stubGlobal('window', target)
  const listener = vi.fn(),
    unsubscribe = subscribeHistory(listener)
  const notify = (key: string | null) => {
    const event = new Event('storage')
    Object.assign(event, { key, storageArea: localStorage })
    target.dispatchEvent(event)
  }
  saveHistory([record('a')])
  notify('yohaku.history.v1')
  expect(listener).toHaveBeenLastCalledWith([record('a')])
  notify('yohaku.settings.v1')
  expect(listener).toHaveBeenCalledTimes(1)
  saveHistory([])
  notify(null)
  expect(listener).toHaveBeenLastCalledWith([])
  unsubscribe()
  notify('yohaku.history.v1')
  expect(listener).toHaveBeenCalledTimes(2)
  vi.unstubAllGlobals()
})

it('exposes failed appends for memory fallback and retries unsaved results', async () => {
  const setItem = vi.fn(() => {
    throw Error('quota')
  })
  vi.stubGlobal('localStorage', { getItem: () => null, setItem })
  const failed = await appendHistory(record('a'))
  expect(failed.saved).toBe(false)
  expect(failed.records.map((r) => r.id)).toEqual(['a'])
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
  })
  const recovered = await appendHistory(record('b'), failed.records)
  expect(recovered.saved).toBe(true)
  expect(readHistory()).toHaveLength(2)
})

it('defaults word colors on for new or legacy settings, while preserving an explicit opt-out', () => {
  expect(readSettings().wordColors).toBe(true)
  data.set('yohaku.settings.v1', '{"guide":false}')
  expect(readSettings().wordColors).toBe(true)
  data.set('yohaku.settings.v1', '{"wordColors":false}')
  expect(readSettings().wordColors).toBe(false)
})

it('round trips weighted penalties and replay identifiers, and discards malformed optional fields', () => {
  const record = {
    id: 'seeded',
    passageId: 'typewell-basic',
    title: '基本常用語',
    layout: 'jis',
    date: '2026-10-29T00:00:00Z',
    elapsed: 60000,
    keys: 400,
    misses: 1,
    kpm: 400,
    accuracy: 99,
    scoreVersion: 3,
    missPenalty: 2.85,
    seed: 'replay',
    replayVersion: 2,
    strokeLimit: 400,
    actualKeys: 401,
  }
  data.set('yohaku.history.v1', JSON.stringify([record]))
  expect(readHistory()[0]).toMatchObject(record)
  data.set(
    'yohaku.history.v1',
    JSON.stringify([
      {
        ...record,
        missPenalty: 'oops',
        seed: 100,
        strokeLimit: 999,
        actualKeys: -1,
      },
    ]),
  )
  expect(readHistory()[0]).toMatchObject({
    missPenalty: undefined,
    seed: undefined,
    strokeLimit: undefined,
    actualKeys: undefined,
  })
})

it('rolls back summary deletion if the best-record store is unavailable', async () => {
  saveHistory([record('keep')])
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (k === 'galactype.bests.v1') throw Error('blocked')
      data.set(k, v)
    },
  })
  expect(await clearHistory()).toBe(false)
  expect(readHistory().map((r) => r.id)).toEqual(['keep'])
})

it('discards corrupted optional comparison metadata before ranking history', () => {
  const broken = {
    ...record('broken'),
    mode: { toString: null },
    rawMisses: { toString: null },
  }
  data.set('yohaku.history.v1', JSON.stringify([broken]))
  expect(readHistory()[0]).toMatchObject({
    mode: undefined,
    rawMisses: undefined,
  })
})

it('round trips ghost comparison metadata without converting it into a practice result', () => {
  const ghost = {
    ...record('ghost'),
    mode: 'ghost' as const,
    ghostSourceId: 'original',
    seed: 'reproducible',
  }
  expect(saveHistory([ghost])).toBe(true)
  expect(readHistory()[0]).toMatchObject(ghost)
})

it('ignores legacy guide opt-outs and accepts new layouts and the slowest CPU preset', () => {
  for (const layout of [
    'colemak',
    'workman',
    'onishi',
    'azerty',
    'norman',
  ] as const) {
    data.set('yohaku.settings.v1', JSON.stringify({ layout, guide: false }))
    expect(readSettings().layout).toBe(layout)
    expect(readSettings()).not.toHaveProperty('guide')
    saveHistory([
      {
        ...record(layout),
        layout,
        mode: 'cpu',
        cpuConfig: { kpm: 35, reactionMs: 250, curve: 'ease-in' },
      },
    ])
    expect(readHistory()[0]).toMatchObject({ layout, cpuConfig: { kpm: 35 } })
  }
})

it('preserves all completed records beyond the former 200-entry limit on read, save and append', async () => {
  const rows = Array.from({ length: 225 }, (_, i) => record(`past-${i}`))
  expect(saveHistory(rows)).toBe(true)
  expect(readHistory()).toHaveLength(225)
  const result = await appendHistory(record('newest'))
  expect(result.saved).toBe(true)
  expect(readHistory()).toHaveLength(226)
  expect(readHistory().some((r) => r.id === 'past-224')).toBe(true)
})
