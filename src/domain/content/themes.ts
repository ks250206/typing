import data from '../../data/generated/themes.json' with { type: 'json' }
import type { Passage } from './passages'
const entries: Passage[] = data.passages.map((entry) => ({
  ...entry,
  splitSentences: entry.continuous || entry.durationMs ? false : undefined,
  accent: entry.durationMs ? '60' : '新',
  source: {
    label:
      entry.id === 'theme-keats'
        ? 'John Keats原詩・GALACTYPE独自訳'
        : 'GALACTYPE独自原稿',
    kind: 'provided',
  },
}))
export const themePassages = entries.filter((p) => !p.durationMs)
export const themeTrainers = entries.filter((p) => p.durationMs)
