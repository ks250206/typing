import data from '../../data/generated/originalLong.json' with { type: 'json' }
import type { Passage } from './passages'

export const originalLongEntries = data.passages
export const originalLongPassages: Passage[] = originalLongEntries.map(
  (entry) => ({
    id: `original-long-${entry.id}`,
    title: entry.title,
    subtitle: `${entry.category} · ${entry.difficulty} · ${entry.charCount}文字 · 全文1問`,
    genre: 'オリジナル長文',
    accent:
      entry.difficulty === '初級'
        ? '初'
        : entry.difficulty === '中級'
          ? '中'
          : '上',
    continuous: true,
    splitSentences: false,
    source: { label: 'ユーザー提供のオリジナル長文', kind: 'provided' },
    paragraphs: [
      { text: entry.text, reading: entry.reading, segments: entry.segments },
    ],
  }),
)
