import type { RecordEntry } from './types'
import {
  chronological,
  recordPoint,
  recordTrend,
  recordValue,
  topRecords,
  type RecordMetric,
} from './recordStats'
import { summarizePace } from './pace'
export type InsightMetric = RecordMetric | 'min' | 'max'
export const insightPace = (r: RecordEntry) =>
  (r.trace ? summarizePace(r.trace) : r.pace)?.moving
export const insightValue = (
  r: RecordEntry,
  metric: InsightMetric,
): number | undefined =>
  metric === 'min' || metric === 'max'
    ? insightPace(r)?.[metric]
    : recordValue(r, metric)
export function insightTop(rows: RecordEntry[], metric: InsightMetric) {
  if (metric === 'point' || metric === 'kpm') return topRecords(rows, metric)
  return rows
    .filter((r) => insightValue(r, metric) !== undefined)
    .sort(
      (a, b) =>
        insightValue(b, metric)! - insightValue(a, metric)! ||
        recordPoint(b) - recordPoint(a) ||
        a.elapsed - b.elapsed ||
        Date.parse(b.date) - Date.parse(a.date),
    )
    .slice(0, 10)
}
export function insightTrend(rows: RecordEntry[], metric: InsightMetric) {
  if (metric === 'point' || metric === 'kpm') return recordTrend(rows, metric)
  const eligible = chronological(
    rows.filter((r) => insightValue(r, metric) !== undefined),
  ).reverse()
  return eligible.map((record, i) => {
    const recent = eligible.slice(Math.max(0, i - 4), i + 1)
    return {
      record,
      average:
        recent.reduce((n, r) => n + insightValue(r, metric)!, 0) /
        recent.length,
    }
  })
}
