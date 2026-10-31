import type { SessionTrace } from './telemetry'
import type { RecordEntry } from './types'
import { recordGroup } from './recordStats'
export const PACE_WINDOW = 5

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
  moving?: {
    window: typeof PACE_WINDOW
    samples: number
    min: number
    max: number
  }
}
/** Only complete trailing windows qualify; never compare a short warm-up average. */
export function movingPace(values: readonly number[]) {
  const result: { time: number; kpm: number }[] = []
  let sum = 0
  for (const [i, value] of values.entries()) {
    sum += value
    if (i >= PACE_WINDOW) sum -= values[i - PACE_WINDOW]
    if (i >= PACE_WINDOW - 1)
      result.push({ time: i + 1, kpm: sum / PACE_WINDOW })
  }
  return result
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
  const chronological = counts.map((count) => count * 60)
  const moving = movingPace(chronological)
  const values = [...chronological].sort((a, b) => a - b)
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
    ...(moving.length
      ? {
          moving: {
            window: PACE_WINDOW,
            samples: moving.length,
            min: Math.min(...moving.map((p) => p.kpm)),
            max: Math.max(...moving.map((p) => p.kpm)),
          },
        }
      : {}),
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
    v.mean <= v.max &&
    (v.moving === undefined ||
      (!!v.moving &&
        v.moving.window === PACE_WINDOW &&
        v.moving.samples === v.samples - PACE_WINDOW + 1 &&
        v.moving.samples > 0 &&
        Number.isFinite(v.moving.min) &&
        Number.isFinite(v.moving.max) &&
        v.moving.min >= 0 &&
        v.moving.min <= v.moving.max))
  )
}
export function paceRanks(
  record: RecordEntry,
  history: RecordEntry[],
  summary = record.trace ? summarizePace(record.trace) : record.pace,
) {
  if (!summary?.moving) return null
  const current = summary.moving
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
    const pace = r.trace ? summarizePace(r.trace) : r.pace
    return pace?.moving?.window === current.window ? [pace.moving] : []
  })
  return {
    min: 1 + past.filter((p) => p.min > current.min).length,
    max: 1 + past.filter((p) => p.max > current.max).length,
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
