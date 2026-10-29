import data from '../../data/generated/etyping.json' with { type: 'json' }
import type { Passage } from './passages'
import { seededRandom } from './typewell'

/** Supplied XML text/readings, with reviewed ruby alignment. No punctuation added. */
export const etypingPassages: Passage[] = data.map((set) => ({
  id: set.id,
  title: set.title,
  genre: 'e-typing',
  accent: 'E',
  subtitle: `${set.entries.length}文から、シードでランダムに15問出題。`,
  source: {
    label: 'uaaaaaaaa.com',
    url: 'https://uaaaaaaaa.com/typing/word',
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
}))
export const isEtyping = (id: string) =>
  etypingPassages.some((p) => p.id === id)

/** Version 1: partial Fisher-Yates, sampling without replacement. Layout-independent. */
export function etypingDocument(id: string, seed: string) {
  const original = etypingPassages.find((p) => p.id === id)
  if (!original) throw new Error(`Unknown e-typing set: ${id}`)
  const pool = [...original.paragraphs]
  const random = seededRandom(`etyping-v1/${id}/${seed}`)
  for (let i = 0; i < 15; i++) {
    const j = i + Math.floor(random() * (pool.length - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const paragraphs = pool.slice(0, 15)
  return {
    passage: { ...original, paragraphs },
    sentences: paragraphs.map((p) => ({ ...p, segments: p.segments! })),
    plan: null,
  }
}
