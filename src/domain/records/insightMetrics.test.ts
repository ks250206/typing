import { expect, it } from 'vitest'
import { insightTop, insightTrend } from './insightMetrics'
import type { RecordEntry } from './types'
const rows: RecordEntry[] = [
  { min: 100, max: 500 },
  { min: 200, max: 400 },
  { min: 0, max: 900 },
].map((moving, i) => ({
  id: String(i),
  passageId: 'p',
  title: 'p',
  layout: 'jis',
  date: new Date(Date.UTC(2026, 9, 31, 0, 0, i)).toISOString(),
  keys: 100,
  elapsed: 10000,
  misses: 0,
  kpm: 600,
  accuracy: 100,
  pace: {
    version: 1,
    samples: 10,
    min: 0,
    max: 1000,
    mean: 500,
    median: 500,
    variance: 0,
    sd: 0,
    p90: 900,
    moving: { window: 5, samples: 6, ...moving },
  },
}))
it('ranks both moving minima and maxima high-first while excluding unknown pace instead of inventing zero', () => {
  const unknown = { ...rows[0], id: 'missing', pace: undefined }
  expect(insightTop([...rows, unknown], 'min').map((r) => r.id)).toEqual([
    '1',
    '0',
    '2',
  ])
  expect(insightTop([...rows, unknown], 'max').map((r) => r.id)).toEqual([
    '2',
    '0',
    '1',
  ])
})
it('plots comparable pace values and their trailing five-attempt averages in time order', () => {
  expect(
    insightTrend([...rows].reverse(), 'min').map((p) => p.average),
  ).toEqual([100, 150, 100])
  expect(insightTrend(rows, 'max').map((p) => p.average)).toEqual([
    500, 450, 600,
  ])
})
it('limits speed rankings to ten and preserves point and KPM comparison', () => {
  const many = Array.from({ length: 25 }, (_, i) => ({
    ...rows[i % 3],
    id: String(i),
  }))
  expect(insightTop(many, 'max')).toHaveLength(10)
  expect(insightTop(rows, 'point')).toHaveLength(3)
  expect(insightTop(rows, 'kpm')).toHaveLength(3)
})
