import type { WeakWord } from '../../domain/records/weakWords'
export const WEAK_DISMISSED = 'galactype.weak-dismissed.v1'
export function readWeakDismissals(): Record<string, string> {
  try {
    const data: unknown = JSON.parse(
      localStorage.getItem(WEAK_DISMISSED) ?? '[]',
    )
    return Array.isArray(data)
      ? Object.fromEntries(
          data
            .slice(0, 100)
            .filter(
              (v) =>
                Array.isArray(v) &&
                v.length === 2 &&
                typeof v[0] === 'string' &&
                typeof v[1] === 'string',
            ),
        )
      : {}
  } catch {
    return {}
  }
}
/** At most 100 candidates/tombstones; a fresh weak encounter gives a word a new source token. */
export function dismissWeakWords(words: WeakWord[], candidates: WeakWord[]) {
  const previous = readWeakDismissals()
  const removing = new Set(words.map((w) => w.id))
  const entries = candidates
    .slice(0, 100)
    .flatMap((w) =>
      removing.has(w.id)
        ? [[w.id, w.source ?? '']]
        : previous[w.id] === (w.source ?? '')
          ? [[w.id, previous[w.id]]]
          : [],
    )
  try {
    localStorage.setItem(WEAK_DISMISSED, JSON.stringify(entries))
    return Object.fromEntries(entries) as Record<string, string>
  } catch {
    return null
  }
}
