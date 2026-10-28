import type { RecordEntry } from './storage'
export const modeOf = (r: RecordEntry) => r.mode ?? 'practice'
export const recordGroup = (r: RecordEntry) =>
  [
    r.passageId,
    r.layout,
    modeOf(r),
    r.strokeLimit ?? '',
    r.replayVersion ?? '',
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
export function topRecords(rows: RecordEntry[]) {
  return [...rows]
    .sort(
      (a, b) =>
        b.kpm - a.kpm ||
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
  return [...groups.values()].flatMap(topRecords)
}
export function recordTrend(rows: RecordEntry[]) {
  const sorted = chronological(rows).reverse()
  return sorted.map((r, i) => ({
    record: r,
    average:
      sorted.slice(Math.max(0, i - 4), i + 1).reduce((n, r) => n + r.kpm, 0) /
      Math.min(5, i + 1),
  }))
}
