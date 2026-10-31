import type { RecordEntry } from './types'
import type { Sentence } from '../content/sentences'
import type { Passage } from '../content/passages'
import { sentenceWordStarts } from '../typing/wordSpacing'
import { validTrace } from './telemetry'

export interface WeakWord extends Sentence {
  id: string
  misses: number
  loss: number
  attempts: number
}
const particles = new Set([
  'から',
  'まで',
  'より',
  'だけ',
  'ほど',
  'など',
  'ので',
  'のに',
  'って',
  'では',
  'には',
  'とは',
  'でも',
  'しか',
  'こそ',
  'さえ',
  'ばかり',
  'くらい',
  'ぐらい',
  'ながら',
])
/** Boundaries must agree with reviewed ruby segments. Never guess a kanji's reading. */
export function extractWeakWords(records: RecordEntry[]): WeakWord[] {
  const words = new Map<string, WeakWord>()
  for (const record of records) {
    const trace = record.trace
    if (!validTrace(trace)) continue
    const intervals = trace.strokes
      .filter((s) => s.correct && s.dt > 0)
      .map((s) => s.dt)
      .sort((a, b) => a - b)
    const baseline = intervals.length
      ? intervals[Math.floor(intervals.length / 2)]
      : 0
    const grouped = new Map<number, typeof trace.strokes>()
    for (const stroke of trace.strokes) {
      const group = grouped.get(stroke.prompt) ?? []
      group.push(stroke)
      grouped.set(stroke.prompt, group)
    }
    trace.prompts.forEach((prompt, index) => {
      if (
        !prompt.segments?.length ||
        prompt.segments.map((s) => s.text).join('') !== prompt.text ||
        prompt.segments.map((s) => s.reading).join('') !== prompt.reading
      )
        return
      const sentence = { ...prompt, segments: prompt.segments }
      const starts = [
        0,
        ...sentenceWordStarts(sentence).segments,
        prompt.segments.length,
      ].sort((a, b) => a - b)
      const offsets = [0]
      for (const part of prompt.segments)
        offsets.push(
          offsets.at(-1)! +
            part.reading.normalize(record.layout === 'kana' ? 'NFD' : 'NFC')
              .length,
        )
      const spans: { start: number; end: number; word: WeakWord }[] = []
      for (let i = 0; i < starts.length - 1; i++) {
        const segments = prompt.segments
          .slice(starts[i], starts[i + 1])
          .map((s) => ({ ...s }))
        let from = starts[i],
          to = starts[i + 1]
        while (segments.length && /^[\p{P}\p{S}\s]+$/u.test(segments[0].text)) {
          segments.shift()
          from++
        }
        while (
          segments.length &&
          /^[\p{P}\p{S}\s]+$/u.test(segments.at(-1)!.text)
        ) {
          segments.pop()
          to--
        }
        const text = segments.map((s) => s.text).join(''),
          reading = segments.map((s) => s.reading).join('')
        if (
          [...text.replace(/[^\p{L}\p{N}]/gu, '')].length < 2 ||
          !reading ||
          particles.has(text)
        )
          continue
        const id = `${text}\u0000${reading}`
        const word = words.get(id) ?? {
          id,
          text,
          reading,
          segments,
          misses: 0,
          loss: 0,
          attempts: 0,
        }
        words.set(id, word)
        spans.push({ start: offsets[from], end: offsets[to], word })
      }
      const seen = new Set<string>()
      for (const stroke of grouped.get(index) ?? []) {
        const span = spans.find(
          (s) => stroke.position >= s.start && stroke.position < s.end,
        )
        if (!span) continue
        span.word.misses += Number(!stroke.correct)
        span.word.loss += Math.max(0, stroke.dt - baseline)
        seen.add(span.word.id)
      }
      for (const id of seen) words.get(id)!.attempts++
    })
  }
  return [...words.values()]
    .filter((w) => w.misses > 0 || w.loss >= 120)
    .sort(
      (a, b) =>
        b.misses - a.misses ||
        b.loss - a.loss ||
        a.text.localeCompare(b.text, 'ja'),
    )
    .slice(0, 100)
}

export function weakDocument(words: WeakWord[], repetitions: number) {
  if (
    !words.length ||
    words.length > 20 ||
    !Number.isInteger(repetitions) ||
    repetitions < 1 ||
    repetitions > 20
  )
    throw Error('練習する単語は1〜20語、繰り返しは1〜20回で選んでください。')
  let hash = 2166136261
  for (const char of JSON.stringify([words.map((w) => w.id), repetitions]))
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  const sentences: Sentence[] = Array.from({ length: repetitions }, () =>
    words.map((w) => ({
      text: w.text,
      reading: w.reading,
      segments: w.segments.map((s) => ({ ...s })),
    })),
  ).flat()
  const passage: Passage = {
    id: `weak-${(hash >>> 0).toString(16)}`,
    title: `苦手ワード · ${words.length}語 × ${repetitions}回`,
    subtitle: '保存した打鍵ログから選んだ単語を反復練習',
    genre: '苦手ワード',
    accent: 'W',
    paragraphs: sentences,
  }
  return { passage, sentences, plan: null }
}
