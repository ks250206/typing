import type { Passage } from './passages'
import importedTrainers from '../../data/generated/trainers.json' with { type: 'json' }
import { seededRandom } from './typewell'

/** Compatibility export derived from the same generated dataset used by the app. */
const sakusakuData = importedTrainers.find((s) => s.id === 'sakusaku-trainer')!
export const sakusakuEntries: [string, string, string][] =
  sakusakuData.entries.map(([text, reading, alignment]) => [
    text as string,
    reading as string,
    (alignment as string[][])
      .filter(([part]) => /^[一-龯々]/u.test(part))
      .map(([, kana]) => kana)
      .join('/'),
  ])
export function randomSentenceIndex(
  length: number,
  previous = -1,
  random = Math.random,
) {
  if (length < 2) return 0
  if (previous < 0) return Math.floor(random() * length)
  const index = Math.floor(random() * (length - 1))
  return index >= previous ? index + 1 : index
}
/** v1 preserves old draws; v2 shuffles a fresh complete bag on every lap. */
export function createTrainerOrder(
  seed: string,
  length: number = sakusakuEntries.length,
  version: 1 | 2 = 2,
) {
  const random = seededRandom(`sakusaku-v${version}/${seed}`)
  let previous = -1
  if (version === 1)
    return () => (previous = randomSentenceIndex(length, previous, random))
  let bag: number[] = []
  let cursor = 0
  let previousBag: number[] = []
  return () => {
    if (cursor >= bag.length) {
      bag = Array.from({ length }, (_, i) => i)
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        ;[bag[i], bag[j]] = [bag[j], bag[i]]
      }
      // Keep lap boundaries smooth and avoid repeating the previous full order.
      // With 1 or 2 prompts, distinct laps and no adjacent repeat are incompatible.
      if (length > 1 && bag[0] === previous) [bag[0], bag[1]] = [bag[1], bag[0]]
      if (length > 2 && bag.every((n, i) => n === previousBag[i]))
        [bag[1], bag[2]] = [bag[2], bag[1]]
      previousBag = [...bag]
      cursor = 0
    }
    return (previous = bag[cursor++] ?? 0)
  }
}
/** Only generated JSON is imported; source snapshots stay outside the browser build. */
export const trainerPassages: Passage[] = importedTrainers.map(
  (set): Passage => ({
    id: set.id,
    title: `打鍵トレーナー · ${set.title}`,
    genre: '60秒トレーナー',
    accent: '60',
    subtitle: `${set.entries.length}文をシードでランダム出題。3秒カウント後に60秒間の正打鍵数を計測。`,
    durationMs: set.durationMs,
    source: {
      label: set.source.label ?? 'タイパー養成所 · 保存HTML',
      url: set.source.url,
      kind: 'provided',
    },
    paragraphs: set.entries.map(([text, reading, alignment]) => ({
      text: text as string,
      reading: reading as string,
      segments: (alignment as string[][]).map(([text, reading]) => ({
        text,
        reading,
      })),
    })),
  }),
)
export const sakusaku = trainerPassages.find(
  (p) => p.id === 'sakusaku-trainer',
)!
export const isTrainer = (id: string) =>
  trainerPassages.some((p) => p.id === id)
