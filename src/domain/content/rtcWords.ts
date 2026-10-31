import themes from '../../data/generated/themes.json' with { type: 'json' }
import importedData from '../../data/generated/rtc.json' with { type: 'json' }
import type { Passage } from './passages'
import type { Sentence } from './sentences'
import { seededRandom } from './typewell'
const data = [
  ...importedData,
  {
    id: 'rtc-ai-ml-llm',
    title: 'RTC風 · AI・機械学習・LLM',
    author: 'GALACTYPE独自原稿',
    parts: themes.rtcParts.map((part) =>
      part.map((p) => [
        p.text,
        p.reading,
        p.segments.map((s) => [s.text, s.reading]),
      ]),
    ),
  },
]
export const rtcPassages: Passage[] = data.map((set) => ({
  id: set.id,
  title: set.title
    .replace(/^(.+)[（(](RTC\d{4})[）)]$/u, '$2 $1')
    .replace(/^(RTC\d{4})\s*/u, '$1 '),
  genre: 'RTC準拠',
  accent: 'RTC',
  subtitle: `${set.parts.map((p) => p.length).join(' × ')}通りのフレーズを連結。シードでランダムに15問出題。`,
  source: {
    label:
      set.id === 'rtc-ai-ml-llm' ? set.author : `提供ZIPのXML · ${set.author}`,
    kind: 'provided',
  },
  paragraphs: [],
}))
export const isRtc = (id: string) => rtcPassages.some((p) => p.id === id)
/** Weather Typing: choose one phrase per Part independently and join in Part order. */
export function rtcPrompts(id: string, seed: string, count = 15): Sentence[] {
  const set = data.find((s) => s.id === id)
  if (!set) throw new Error(`Unknown RTC set: ${id}`)
  const random = seededRandom(`weather-v1/${id}/${seed}`)
  return Array.from({ length: count }, () => {
    const segments = set.parts.flatMap((part) => {
      const row = part[Math.floor(random() * part.length)]
      return (row[2] as string[][]).map(([text, reading]) => ({
        text,
        reading,
      }))
    })
    return {
      text: segments.map((s) => s.text).join(''),
      reading: segments.map((s) => s.reading).join(''),
      segments,
    }
  })
}
export function rtcDocument(id: string, seed: string) {
  const sentences = rtcPrompts(id, seed)
  return {
    passage: {
      ...rtcPassages.find((p) => p.id === id)!,
      paragraphs: sentences,
    },
    sentences,
    plan: null,
  }
}
