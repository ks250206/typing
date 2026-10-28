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
