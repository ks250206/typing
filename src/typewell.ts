import classicData from './data/typewell.json' with { type: 'json' }
import { spaceWords } from './spaceWords'
import { KanaEngine, RomanEngine } from './engine'
import type { Layout } from './engine'
import type { Passage } from './passages'
import type { Sentence } from './sentences'
import { readingCursor } from './readingCursor'

const data = { ...classicData, space: spaceWords }

export const typewellSets = [
  { id: 'typewell-basic', category: 'basic', title: '基本常用語', pages: 3 },
  {
    id: 'typewell-katakana',
    category: 'katakana',
    title: 'カタカナ語',
    pages: 6,
  },
  { id: 'typewell-kanji', category: 'kanji', title: '漢字', pages: 4 },
  {
    id: 'typewell-idioms',
    category: 'idioms',
    title: '慣用句・ことわざ',
    pages: 4,
  },
  { id: 'typewell-space', category: 'space', title: '宇宙の名前', pages: 0 },
] as const
export const typewellPassages: Passage[] = typewellSets.map((set, index) => ({
  id: set.id,
  title: `タイプウェル · ${set.title}`,
  genre: 'タイプウェル',
  subtitle:
    set.category === 'space'
      ? `${spaceWords.length}の天体名。恒星・銀河・小惑星・衛星・惑星を旅する。R 400打 / K 280打。`
      : `全${set.pages}ページ・${data[set.category].length.toLocaleString()}語を集約。R 400打 / K 280打。`,
  accent: `T${index + 1}`,
  paragraphs: [],
}))
export const isTypewell = (id: string) =>
  typewellSets.some((set) => set.id === id)
export const strokeLimit = (layout: Layout) => (layout === 'kana' ? 280 : 400)
export const freshSeed = () =>
  crypto.getRandomValues(new Uint32Array(1))[0].toString(16).padStart(8, '0')

/** FNV-1a + Mulberry32, version 1. No locale/date/platform dependent randomness. */
export function seededRandom(seed: string) {
  let state = 2166136261
  for (const char of seed)
    state = Math.imul(state ^ char.charCodeAt(0), 16777619)
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), state | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}
export function typewellDocument(id: string, seed: string) {
  const set = typewellSets.find((set) => set.id === id)!
  const pool = data[set.category]
  const random = seededRandom(`${set.id}/v1/${seed}`)
  const segments: Sentence['segments'] = []
  // Reserve beyond the 400-key cutoff so shorter alternative spellings cannot exhaust it.
  // Even a one-keystroke/two-kana contraction leaves at least 400 accepted keys.
  let length = 0
  while (length < 1000) {
    const [text, reading] = pool[Math.floor(random() * pool.length)]
    if (segments.length) {
      segments.push({ text: ' ', reading: ' ' })
      length++
    }
    segments.push({ text, reading })
    length += reading.length
  }
  const sentence: Sentence = {
    text: segments.map((s) => s.text).join(''),
    reading: segments.map((s) => s.reading).join(''),
    segments,
  }
  return {
    passage: {
      ...typewellPassages.find((p) => p.id === id)!,
      paragraphs: [sentence],
    },
    sentences: [sentence],
  }
}

/** Show only words intersecting the remaining key budget. A final word may be partial. */
export function typewellView(
  sentence: Sentence,
  typed: string,
  hint: string,
  layout: Layout,
  naturalKeys: number,
) {
  const remaining = Math.max(0, strokeLimit(layout) - naturalKeys)
  const visibleHint =
    layout === 'kana'
      ? sentence.reading
          .normalize('NFD')
          .slice(typed.length, typed.length + remaining)
      : hint.slice(0, remaining)
  const engine =
    layout === 'kana'
      ? new KanaEngine(sentence.reading)
      : new RomanEngine(sentence.reading, true)
  for (const char of typed + visibleHint) engine.feed(char)
  const end =
    engine.position +
    (engine.done
      ? 0
      : readingCursor(engine.target, engine.position).current.length)
  let offset = 0
  const segments = sentence.segments.filter((segment) => {
    const start = offset
    offset += segment.reading.normalize(
      layout === 'kana' ? 'NFD' : 'NFC',
    ).length
    return start < end
  })
  const current = {
    text: segments.map((s) => s.text).join(''),
    reading: segments.map((s) => s.reading).join(''),
    segments,
  }
  return {
    current,
    target: current.reading.normalize(layout === 'kana' ? 'NFD' : 'NFC'),
    hint: visibleHint,
  }
}
