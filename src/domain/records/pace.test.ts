import { expect, it } from 'vitest'
import { TypingTrace } from './telemetry'
import {
  intervalStatistics,
  paceRanks,
  summarizePace,
  validPace,
  movingPace,
} from './pace'
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
function countedTrace(counts: number[]) {
  const trace = new TypingTrace()
  trace.begin(sentence, 0, 'jis')
  for (const [second, count] of counts.entries())
    for (let i = 0; i < count; i++)
      trace.add('a', 'a', 0, true, second * 1000 + (i + 1) * 10)
  return trace.finish(counts.length * 1000 + 500)
}
it('calculates complete trailing five-second averages before sorting raw values', () => {
  expect(movingPace([0, 600, 0, 600])).toEqual([])
  expect(movingPace([0, 600, 0, 600, 0, 0, 300])).toEqual([
    { time: 5, kpm: 240 },
    { time: 6, kpm: 240 },
    { time: 7, kpm: 180 },
  ])
  const summary = summarizePace(countedTrace([0, 10, 0, 10, 0, 0, 5]))!
  expect(summary.moving).toEqual({ window: 5, samples: 3, min: 180, max: 240 })
  expect(validPace(summary)).toBe(true)
  expect(validPace({ ...summary, moving: undefined })).toBe(true) // stored v1 summary remains readable
  expect(
    validPace({ ...summary, moving: { ...summary.moving, window: 3 } }),
  ).toBe(false)
  expect(
    validPace({ ...summary, moving: { ...summary.moving, samples: 4 } }),
  ).toBe(false)
})
it('ranks moving minima and maxima, deduplicates and rebuilds legacy summaries from logs without mixing raw extrema', () => {
  const trace = countedTrace([0, 10, 0, 10, 0, 0, 5])
  const record: RecordEntry = {
    id: 'now',
    passageId: 'p',
    title: 'p',
    layout: 'onishi',
    date: '2026-10-31T01:00:00Z',
    elapsed: trace.elapsed,
    keys: 25,
    misses: 0,
    accuracy: 100,
    kpm: 120,
    trace,
  }
  const better = {
    ...record,
    id: 'better',
    date: '2026-10-30T01:00:00Z',
    trace: undefined,
    pace: summarizePace(countedTrace([10, 10, 10, 0, 0, 10, 10])),
  }
  const tie = { ...record, id: 'tie', date: better.date }
  const ignored = { ...better, id: 'wrong', layout: 'jis' as const }
  const oldPace = { ...summarizePace(trace)!, moving: undefined }
  const legacy = { ...tie, id: 'legacy', pace: oldPace }
  expect(
    paceRanks(record, [
      record,
      better,
      better,
      tie,
      ignored,
      legacy,
      { ...legacy, id: 'no-log', trace: undefined },
      { ...better, id: 'future', date: '2026-11-01T01:00:00Z' },
    ]),
  ).toEqual({ min: 2, max: 2, count: 4 })
  expect(paceRanks({ ...record, trace: undefined }, [])).toBeNull()
  expect(paceRanks({ ...record, trace: data }, [])).toBeNull() // under 5 seconds
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
