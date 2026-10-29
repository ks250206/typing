import { expect, it } from 'vitest'
import {
  archiveBests,
  recordGroup,
  recordTrend,
  topRecords,
} from './recordStats'
import { appendHistory, readBestHistory, readHistory } from './storage'
import { vi } from 'vitest'
import type { RecordEntry } from './storage'
const row = (i: number, kpm = i): RecordEntry => ({
  id: String(i),
  passageId: 'typewell-space',
  title: '宇宙',
  layout: 'jis',
  mode: 'practice',
  date: new Date(i * 1000).toISOString(),
  elapsed: 60000,
  keys: kpm,
  misses: 0,
  kpm,
  accuracy: 100,
  replayVersion: 2,
  strokeLimit: 400,
})
it('computes chronological previous records and trailing five-session averages without mixing modes/layout/version', () => {
  const rows = [
    row(6, 600),
    row(2, 200),
    row(1, 100),
    row(5, 500),
    row(4, 400),
    row(3, 300),
  ]
  expect(recordTrend(rows).map((p) => p.average)).toEqual([
    100, 150, 200, 250, 300, 400,
  ])
  expect(topRecords(rows).map((p) => p.kpm)).toEqual([
    600, 500, 400, 300, 200, 100,
  ])
  expect(recordGroup(row(1))).not.toBe(
    recordGroup({ ...row(1), layout: 'kana' }),
  )
  expect(recordGroup(row(1))).not.toBe(recordGroup({ ...row(1), mode: 'cpu' }))
  expect(recordGroup(row(1))).not.toBe(
    recordGroup({ ...row(1), replayVersion: 1 }),
  )
  const a = {
    ...row(1),
    mode: 'cpu' as const,
    cpuConfig: { kpm: 300, reactionMs: 200, curve: 'constant' as const },
  }
  expect(recordGroup(a)).not.toBe(
    recordGroup({ ...a, cpuConfig: { ...a.cpuConfig, kpm: 600 } }),
  )
})
it('archives only the best ten unique records in each comparable group', () => {
  const rows = Array.from({ length: 30 }, (_, i) => row(i))
  expect(archiveBests([...rows, ...rows])).toHaveLength(10)
  expect(archiveBests(rows).map((r) => r.kpm)).toEqual([
    29, 28, 27, 26, 25, 24, 23, 22, 21, 20,
  ])
  expect(
    archiveBests([...rows, { ...row(0), id: 'kana', layout: 'kana' }]),
  ).toHaveLength(11)
})
it('keeps historical top scores after they leave the latest 200 summaries', async () => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
  })
  try {
    await appendHistory(row(0, 9999))
    // Batch as recoverable appends to avoid 200 unnecessary writes in this test.
    await appendHistory(
      row(202, 100),
      Array.from({ length: 201 }, (_, i) => row(i + 1, 100)),
    )
    expect(readHistory()).toHaveLength(200)
    expect(readHistory().some((r) => r.id === '0')).toBe(false)
    expect(readBestHistory()[0].kpm).toBe(9999)
  } finally {
    vi.unstubAllGlobals()
  }
})

import { recordPoint } from './recordStats'
it('ranks by adjusted points first, keeps KPM ranking and computes both moving averages', () => {
  const fast = { ...row(1, 600), missPenalty: 600, point: 9999 }
  const accurate = row(2, 400)
  expect(recordPoint(fast)).toBe(150)
  expect(topRecords([fast, accurate]).map((r) => r.id)).toEqual(['2', '1'])
  expect(topRecords([fast, accurate], 'kpm').map((r) => r.id)).toEqual([
    '1',
    '2',
  ])
  expect(recordTrend([fast, accurate]).at(-1)).toMatchObject({
    pointAverage: 275,
    kpmAverage: 500,
    average: 275,
  })
  expect(recordTrend([fast, accurate], 'kpm').at(-1)?.average).toBe(500)
  const legacy = { ...row(3, 300), misses: 100 }
  expect(recordPoint(legacy)).toBe(168)
})
it('retains distinct historical point and speed top tens after the recent record limit', async () => {
  const slowAccurate = Array.from({ length: 10 }, (_, i) => row(i, 400 + i))
  const fastInaccurate = Array.from({ length: 10 }, (_, i) => ({
    ...row(i + 10, 800 + i),
    missPenalty: 800,
  }))
  const archive = archiveBests([...slowAccurate, ...fastInaccurate])
  expect(archive).toHaveLength(20)
  expect(topRecords(archive).every((r) => Number(r.id) < 10)).toBe(true)
  expect(topRecords(archive, 'kpm').every((r) => Number(r.id) >= 10)).toBe(true)
})

import { recordTitle, recordMissLabel } from './recordStats'
it('uses actual accepted keys and raw consecutive misses for titles, and labels legacy fallback', () => {
  const r = {
    ...row(1, 400),
    keys: 400,
    actualKeys: 500,
    misses: 1,
    rawMisses: 60,
    missPenalty: 10,
  }
  expect(recordTitle(r)).toMatch(/^暴走する/)
  expect(recordMissLabel(r)).toContain('実ミス率')
  const legacy = { ...row(2, 400), misses: 10 }
  expect(recordTitle(legacy)).toMatch(/^堅実な/)
  expect(recordMissLabel(legacy)).toMatch(/^旧集約ミス率/)
})
