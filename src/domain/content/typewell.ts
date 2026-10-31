import themes from '../../data/generated/themes.json' with { type: 'json' }
import classicData from '../../data/generated/typewell.json' with { type: 'json' }
import { legacySpaceWords, spaceWords } from './spaceWords'
import { KanaEngine, RomanEngine } from '../typing/engine'
import type { Layout } from '../typing/engine'
import type { Passage } from './passages'
import type { Sentence } from './sentences'

const data = { ...classicData, ...themes.words, space: spaceWords }

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
  {
    id: 'typewell-scientists',
    category: 'scientists',
    title: '科学者の名前',
    pages: 0,
  },
  { id: 'typewell-sf', category: 'sf', title: 'SF小説の名前', pages: 0 },
] as const
export const typewellPassages: Passage[] = typewellSets.map((set, index) => ({
  id: set.id,
  title: `${set.pages === 0 ? 'タイプウェル準拠' : 'タイプウェル'} · ${set.title}`,
  genre: 'タイプウェル',
  subtitle:
    set.category === 'space'
      ? `${spaceWords.length}の天体名。恒星・銀河・小惑星・衛星・惑星を旅する。R 400打 / K 280打。`
      : set.pages === 0
        ? `${data[set.category].length}語。シードでランダム出題。R 400打 / K 280打。`
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
export interface TypewellPlan {
  readonly sentence: Sentence
  readonly reference: string
  readonly limit: number
  readonly layout: Layout
  readonly trailing: number
}

/** Plan the fixed reference and endpoint before any input is accepted. */
export function planTypewell(sentence: Sentence, layout: Layout): TypewellPlan {
  const limit = strokeLimit(layout)
  const reference =
    layout === 'kana'
      ? new KanaEngine(sentence.reading).target.slice(0, limit)
      : new RomanEngine(sentence.reading, true).hint.slice(0, limit)
  if (reference.length !== limit)
    throw new Error('TypeWell source is too short')
  return Object.freeze({
    sentence,
    reference,
    limit,
    layout,
    trailing:
      layout === 'kana'
        ? 0
        : new RomanEngine(sentence.reading, true).naturalRemaining - limit,
  })
}

/** The fixed tail is not practice input; alternate spellings cannot move the endpoint. */
export class PlannedRomanEngine extends RomanEngine {
  readonly plan: TypewellPlan
  constructor(plan: TypewellPlan) {
    super(plan.sentence.reading, true)
    this.plan = plan
  }
  override get done() {
    return this.naturalRemaining <= this.plan.trailing
  }
  override get hint() {
    return this.naturalHint.slice(
      0,
      Math.max(0, this.naturalRemaining - this.plan.trailing),
    )
  }
  override feed(key: string) {
    return !this.done && super.feed(key)
  }
}
export function typewellEngine(plan: TypewellPlan) {
  return plan.layout === 'kana'
    ? new KanaEngine(plan.reference)
    : new PlannedRomanEngine(plan)
}
export function typewellDocument(
  id: string,
  seed: string,
  layout: Layout = 'jis',
  version: 1 | 2 = 2,
) {
  const set = typewellSets.find((set) => set.id === id)!
  const pool =
    version === 1 && set.category === 'space'
      ? legacySpaceWords
      : data[set.category]
  const random = seededRandom(`${set.id}/v${version}/${seed}`)
  const segments: Sentence['segments'] = []
  let count = 0
  // Include only the words covering the predetermined budget. The last word's
  // unused tail preserves its spelling context (notably a terminal n + space).
  while (count < strokeLimit(layout)) {
    const [text, reading] = pool[Math.floor(random() * pool.length)]
    segments.push({ text, reading }, { text: ' ', reading: ' ' })
    count +=
      layout === 'kana'
        ? new KanaEngine(reading + ' ').target.length
        : new RomanEngine(reading + ' ', true).hint.length
  }
  const sentence: Sentence = {
    text: segments.map((s) => s.text).join(''),
    reading: segments.map((s) => s.reading).join(''),
    segments,
  }
  const plan = planTypewell(sentence, layout)
  return {
    passage: {
      ...typewellPassages.find((p) => p.id === id)!,
      ...(version === 1 && set.category === 'space'
        ? { subtitle: '64語の旧v1辞書を再現中。R 400打 / K 280打。' }
        : {}),
      paragraphs: [sentence],
    },
    sentences: [sentence],
    plan,
  }
}

/** RTC uses one dictionary word per point, rather than the solo 400-key line. */
export function typewellPromptPool(id: string): Sentence[] {
  const set = typewellSets.find((s) => s.id === id)
  if (!set) throw new Error(`Unknown TypeWell set: ${id}`)
  return data[set.category].map(([text, reading]) => ({
    text,
    reading,
    segments: [{ text, reading }],
  }))
}
