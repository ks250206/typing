import { expect, it } from 'vitest'
import { TypingTrace } from './telemetry'
import { intervalStatistics, paceRanks, summarizePace, validPace } from './pace'
import type { RecordEntry } from './types'

const sentence = {
  text: 'あいうえお',
  reading: 'あいうえお',
  segments: [{ text: 'あいうえお', reading: 'あいうえお' }],
}
const trace = new TypingTrace()
trace.begin(sentence, 0, 'jis')
for (const t of [100, 200, 1100, 1200, 1300, 1400, 3100])
  trace.add('a', 'a', 0, true, t)
const data = trace.finish(3500)
it('uses complete seconds including idle seconds, rejects a fractional-only run, and calculates population variance', () => {
  // Counts [2,4,0], not the final partial second's 1 key.
  const stats = summarizePace(data)!
  expect(stats).toMatchObject({
    samples: 3,
    min: 0,
    max: 240,
    mean: 120,
    median: 120,
    variance: 9600,
    p90: 216,
  })
  expect(stats.sd).toBeCloseTo(Math.sqrt(9600))
  expect(validPace(stats)).toBe(true)
  expect(validPace({ ...stats, min: -1 })).toBe(false)
  expect(summarizePace({ ...data, elapsed: 999 })).toBeUndefined()
})
it('ranks higher minima and maxima first, deduplicates, ignores other groups and newer dates, and handles ties', () => {
  const record: RecordEntry = {
    id: 'now',
    passageId: 'p',
    title: 'p',
    layout: 'onishi',
    date: '2026-10-31T01:00:00Z',
    elapsed: 3500,
    keys: 7,
    misses: 0,
    accuracy: 100,
    kpm: 120,
    trace: data,
  }
  const better = {
    ...record,
    id: 'better',
    date: '2026-10-30T01:00:00Z',
    trace: undefined,
    pace: { ...summarizePace(data)!, min: 60, max: 300 },
  }
  const tie = { ...record, id: 'tie', date: better.date }
  const ignored = { ...better, id: 'wrong', layout: 'jis' as const }
  expect(
    paceRanks(record, [
      record,
      better,
      better,
      tie,
      ignored,
      { ...better, id: 'future', date: '2026-11-01T01:00:00Z' },
    ]),
  ).toEqual({ min: 2, max: 2, count: 3 })
  expect(paceRanks({ ...record, trace: undefined }, [])).toBeNull()
})
it('reports inter-key timing and the longest real error streak', () => {
  const trace = new TypingTrace()
  trace.begin(sentence, 0, 'jis')
  trace.add('x', 'a', 0, false, 100)
  trace.add('x', 'a', 0, false, 200)
  trace.add('a', 'a', 0, true, 300)
  trace.add('x', 'i', 1, false, 1000)
  expect(intervalStatistics(trace.finish(1000))).toEqual({
    mean: 250,
    median: 100,
    max: 700,
    longestMissStreak: 2,
  })
})
