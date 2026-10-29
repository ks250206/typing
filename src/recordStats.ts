import type { RecordEntry } from './storage'
import { scorePoint, typingTitle, formatMissRate } from './scoring'
export type RecordMetric = 'point' | 'kpm'
/** Same calculation as the existing history table, including legacy miss-count fallback. */
export const recordPoint = (r: RecordEntry) =>
  scorePoint(r.keys, r.missPenalty ?? r.misses, r.elapsed)
export const recordTitle = (r: RecordEntry) =>
  typingTitle(recordPoint(r), r.actualKeys ?? r.keys, r.rawMisses ?? r.misses)
export const recordMissLabel = (r: RecordEntry) =>
  `${r.rawMisses === undefined ? '旧集約ミス率' : '実ミス率'} ${formatMissRate(r.actualKeys ?? r.keys, r.rawMisses ?? r.misses)}`
export const recordValue = (r: RecordEntry, metric: RecordMetric = 'point') =>
  metric === 'point' ? recordPoint(r) : r.kpm
export const modeOf = (r: RecordEntry) => r.mode ?? 'practice'
export const recordGroup = (r: RecordEntry) =>
  [
    r.passageId,
    r.layout,
    modeOf(r),
    r.strokeLimit ?? '',
    r.replayVersion ?? '',
    ...(r.mode === 'ghost' ? [r.ghostSourceId ?? ''] : []),
    ...(r.mode === 'cpu'
      ? [
          r.cpuConfig?.kpm ?? '',
          r.cpuConfig?.reactionMs ?? '',
          r.cpuConfig?.curve ?? '',
        ]
      : []),
  ].join('/')
export const chronological = (rows: RecordEntry[]) =>
  [...rows].sort(
    (a, b) =>
      Date.parse(b.date) - Date.parse(a.date) || b.id.localeCompare(a.id),
  )
export function topRecords(
  rows: RecordEntry[],
  metric: RecordMetric = 'point',
) {
  return [...rows]
    .sort(
      (a, b) =>
        recordValue(b, metric) - recordValue(a, metric) ||
        recordValue(b, metric === 'point' ? 'kpm' : 'point') -
          recordValue(a, metric === 'point' ? 'kpm' : 'point') ||
        a.elapsed - b.elapsed ||
        (a.rawMisses ?? a.misses) - (b.rawMisses ?? b.misses) ||
        Date.parse(b.date) - Date.parse(a.date),
    )
    .slice(0, 10)
}
export function archiveBests(rows: RecordEntry[]) {
  const groups = new Map<string, RecordEntry[]>()
  for (const row of new Map(rows.map((r) => [r.id, r])).values()) {
    const key = recordGroup(row)
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return [...groups.values()].flatMap((rows) => [
    ...new Map(
      [...topRecords(rows, 'point'), ...topRecords(rows, 'kpm')].map((r) => [
        r.id,
        r,
      ]),
    ).values(),
  ])
}
export function recordTrend(
  rows: RecordEntry[],
  metric: RecordMetric = 'point',
) {
  const sorted = chronological(rows).reverse()
  return sorted.map((r, i) => {
    const recent = sorted.slice(Math.max(0, i - 4), i + 1)
    const pointAverage =
      recent.reduce((n, r) => n + recordPoint(r), 0) / recent.length
    const kpmAverage = recent.reduce((n, r) => n + r.kpm, 0) / recent.length
    return {
      record: r,
      pointAverage,
      kpmAverage,
      average: metric === 'point' ? pointAverage : kpmAverage,
    }
  })
}
