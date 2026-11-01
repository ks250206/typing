import type { SentenceStats } from '../../domain/records/sentencePractice'
export const SENTENCE_STATS = 'galactype.sentence-stats.v1'
export const SENTENCE_STATS_CLEARED = 'galactype.sentence-stats-cleared'
export function readSentenceStats(): SentenceStats {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(SENTENCE_STATS) ?? '{}',
    )
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(
      Object.entries(value).filter(
        ([id, row]) =>
          id.startsWith('[') &&
          row &&
          typeof row === 'object' &&
          ['best', 'kpm', 'elapsed', 'tries', 'keys', 'misses'].every(
            (field) =>
              typeof row[field] === 'number' &&
              Number.isFinite(row[field]) &&
              row[field] >= 0,
          ) &&
          Number.isInteger(row.tries) &&
          Number.isInteger(row.keys) &&
          Number.isInteger(row.misses),
      ),
    )
  } catch {
    return {}
  }
}
export function saveSentenceStats(stats: SentenceStats) {
  localStorage.setItem(SENTENCE_STATS, JSON.stringify(stats))
}
