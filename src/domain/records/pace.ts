import type { SessionTrace } from './telemetry'
import type { RecordEntry } from './types'
import { recordGroup } from './recordStats'

export interface PaceSummary {
  version: 1
  samples: number
  min: number
  max: number
  mean: number
  median: number
  variance: number
  sd: number
  p90: number
}
const quantile = (sorted: number[], p: number) => {
  const position = (sorted.length - 1) * p
  const lo = Math.floor(position),
    hi = Math.ceil(position)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (position - lo)
}
/** Compare full one-second windows, including idle windows, without inflating the final fraction. */
export function summarizePace(trace: SessionTrace): PaceSummary | undefined {
  const counts = Array<number>(Math.floor(trace.elapsed / 1000)).fill(0)
  if (!counts.length) return undefined
  for (const stroke of trace.strokes) {
    const index = Math.min(
      Math.ceil(trace.elapsed / 1000) - 1,
      Math.floor(stroke.t / 1000),
    )
    if (stroke.correct && index < counts.length) counts[index]++
  }
  const values = counts.map((count) => count * 60).sort((a, b) => a - b)
  if (!values.length) return undefined
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  return {
    version: 1,
    samples: values.length,
    min: values[0],
    max: values.at(-1)!,
    mean,
    median: quantile(values, 0.5),
    variance,
    sd: Math.sqrt(variance),
    p90: quantile(values, 0.9),
  }
}
export function validPace(value: unknown): value is PaceSummary {
  if (!value || typeof value !== 'object') return false
  const v = value as PaceSummary
  return (
    v.version === 1 &&
    Number.isInteger(v.samples) &&
    v.samples > 0 &&
    ['min', 'max', 'mean', 'median', 'variance', 'sd', 'p90'].every((k) => {
      const n = v[k as keyof PaceSummary]
      return typeof n === 'number' && Number.isFinite(n) && n >= 0
    }) &&
    v.min <= v.max &&
    v.mean >= v.min &&
    v.mean <= v.max
  )
}
export function paceRanks(
  record: RecordEntry,
  history: RecordEntry[],
  summary = record.pace ??
    (record.trace ? summarizePace(record.trace) : undefined),
) {
  if (!summary) return null
  const past = [
    ...new Map(
      history
        .filter(
          (r) =>
            r.id !== record.id &&
            Date.parse(r.date) <= Date.parse(record.date) &&
            recordGroup(r) === recordGroup(record),
        )
        .map((r) => [r.id, r]),
    ).values(),
  ].flatMap((r) => {
    const pace = r.pace ?? (r.trace ? summarizePace(r.trace) : undefined)
    return pace ? [pace] : []
  })
  return {
    min: 1 + past.filter((p) => p.min > summary.min).length,
    max: 1 + past.filter((p) => p.max > summary.max).length,
    count: past.length + 1,
  }
}
export function intervalStatistics(trace: SessionTrace) {
  const intervals = trace.strokes
    .filter((s) => s.dt > 0)
    .map((s) => s.dt)
    .sort((a, b) => a - b)
  let streak = 0,
    longestMissStreak = 0
  for (const stroke of trace.strokes) {
    streak = stroke.correct ? 0 : streak + 1
    longestMissStreak = Math.max(longestMissStreak, streak)
  }
  return {
    median: intervals.length ? quantile(intervals, 0.5) : 0,
    mean: intervals.reduce((n, v) => n + v, 0) / Math.max(1, intervals.length),
    max: intervals.at(-1) ?? 0,
    longestMissStreak,
  }
}
