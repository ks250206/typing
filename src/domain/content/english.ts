import data from '../../data/generated/english.json' with { type: 'json' }
import type { Passage } from './passages'
import type { Sentence } from './sentences'
import { englishOriginalPassages } from './englishOriginal'
import { seededRandom } from './typewell'

export const englishPassages: Passage[] = [
  ...englishOriginalPassages,
  ...data.map((set) => ({
    id: set.id,
    language: 'en' as const,
    title: `${set.kind === 'etyping' ? 'e-typing' : 'TypeWell'} · ${set.title}`,
    genre: set.kind === 'etyping' ? 'e-typing' : 'タイプウェル',
    accent: set.kind === 'etyping' ? 'EE' : 'ET',
    subtitle: `${set.entries.length.toLocaleString()}文・語 · ${set.kind === 'etyping' ? '15問をランダム出題' : 'スペースを含む400打'} · 2012年収録`,
    source: {
      label: 'physics-HTFI / TypeLighter（e-typing・TypeWell収録データ）',
      url: 'https://github.com/physics-HTFI/TypeLighter',
      kind: 'provided' as const,
    },
    paragraphs: set.entries.map((text) => ({ text, reading: text })),
  })),
]
export const isEnglish = (id: string) =>
  englishPassages.some((p) => p.id === id)
export const isEnglishTypewell = (id: string) =>
  id.startsWith('en-typewell-') && isEnglish(id)
export const isSeededEnglish = (id: string) =>
  isEnglish(id) && /^en-(etyping|typewell)-/.test(id)

export function englishSentence(text: string, continuous = false): Sentence {
  const segments = (text.match(/\S+| +/g) ?? []).map((text) => ({
    text,
    reading: text,
  }))
  const wordStarts = [...text.matchAll(/\S+/g)]
    .map((m) => m.index)
    .filter((i) => i > 0)
  return {
    language: 'en',
    text,
    reading: text,
    segments,
    wordStarts,
    ...(continuous ? { continuous: true } : {}),
  }
}

export function englishDocument(id: string, seed: string) {
  const source = englishPassages.find((p) => p.id === id)
  if (!source) throw new Error(`Unknown English set: ${id}`)
  const random = seededRandom(`english-v1/${id}/${seed}`)
  let lines = source.paragraphs.map((p) => p.text)
  if (isEnglishTypewell(id)) {
    let text = ''
    while (text.length < 400)
      text += `${text ? ' ' : ''}${lines[Math.floor(random() * lines.length)]}`
    lines = [text.slice(0, 400)]
  } else if (isSeededEnglish(id)) {
    for (let i = lines.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[lines[i], lines[j]] = [lines[j], lines[i]]
    }
    lines = lines.slice(0, 15)
  }
  const sentences = lines.map((text) =>
    englishSentence(text, source.continuous),
  )
  return {
    passage: { ...source, paragraphs: sentences },
    sentences,
    plan: null,
  }
}
