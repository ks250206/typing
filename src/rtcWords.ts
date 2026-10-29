import data from './data/rtc.json' with { type: 'json' }
import type { Passage } from './passages'
import type { Sentence } from './sentences'
import { seededRandom } from './typewell'
export const rtcPassages: Passage[] = data.map((set) => ({
  id: set.id,
  title: `${set.title}（RTC準拠）`,
  genre: 'RTC準拠',
  accent: 'RTC',
  subtitle: `${set.parts.map((p) => p.length).join(' × ')}通りのフレーズを連結。シードでランダムに15問出題。`,
  source: { label: `提供ZIPのXML · ${set.author}`, kind: 'provided' },
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
