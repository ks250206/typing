import type { Sentence, ReadingSegment } from '../content/sentences'
import type { Layout } from '../typing/engine'

export interface Stroke {
  t: number
  dt: number
  key: string
  expected: string
  correct: boolean
  prompt: number
  position: number
  character: string
}
export interface TracePrompt {
  continuous?: boolean
  label?: string
  segments?: ReadingSegment[]
  wordStarts?: number[]
  text: string
  reading: string
  start: number
  end: number
}
export interface SessionTrace {
  version: 1
  elapsed: number
  prompts: TracePrompt[]
  strokes: Stroke[]
}
/** Only active typing time enters this recorder. Pauses/countdowns are excluded upstream. */
export class TypingTrace {
  private data: SessionTrace = {
    version: 1,
    elapsed: 0,
    prompts: [],
    strokes: [],
  }
  private previous = 0
  private characters: { end: number; text: string }[] = []
  begin(sentence: Sentence, time: number, layout: Layout) {
    const last = this.data.prompts.at(-1)
    if (last) last.end = time
    this.data.prompts.push({
      ...(sentence.continuous ? { continuous: true } : {}),
      segments: sentence.segments.map((s) => ({ ...s })),
      ...(sentence.wordStarts ? { wordStarts: [...sentence.wordStarts] } : {}),
      ...(sentence.label ? { label: sentence.label } : {}),
      text: sentence.text,
      reading: sentence.reading,
      start: time,
      end: time,
    })
    this.previous = time
    let end = 0
    this.characters = sentence.segments.map((s) => ({
      text: s.text,
      end: (end += s.reading.normalize(
        layout === 'kana' ? 'NFD' : 'NFC',
      ).length),
    }))
  }
  close(time: number) {
    const last = this.data.prompts.at(-1)
    if (last) last.end = time
  }
  add(
    key: string,
    expected: string,
    position: number,
    correct: boolean,
    time: number,
  ) {
    const t = Math.max(this.previous, time)
    this.data.strokes.push({
      t,
      dt: t - this.previous,
      key,
      expected,
      position,
      correct,
      prompt: this.data.prompts.length - 1,
      character:
        this.characters.find((s) => position < s.end)?.text ?? expected,
    })
    this.previous = t
    this.close(t)
  }
  finish(elapsed: number): SessionTrace {
    this.close(elapsed)
    return {
      ...this.data,
      elapsed,
      prompts: this.data.prompts.map((p) => ({
        ...p,
        segments: p.segments?.map((s) => ({ ...s })),
        ...(p.wordStarts ? { wordStarts: [...p.wordStarts] } : {}),
      })),
      strokes: this.data.strokes.map((s) => ({ ...s })),
    }
  }
}
export function analyzeTrace(trace: SessionTrace) {
  // Median successful inter-key interval is robust to a handful of long stalls.
  const intervals = trace.strokes
    .filter((s) => s.correct && s.dt > 0)
    .map((s) => s.dt)
    .sort((a, b) => a - b)
  const mid = Math.floor(intervals.length / 2)
  const baseline = intervals.length
    ? (intervals[mid] +
        intervals[Math.max(0, Math.ceil(intervals.length / 2) - 1)]) /
      2
    : 0
  const loss = (s: Stroke) => Math.max(0, s.dt - baseline)
  const characters = trace.strokes
    .map((s) => ({ ...s, loss: loss(s) }))
    .sort((a, b) => b.loss - a.loss)
  let cumulative = 0
  const buckets = Array.from(
    { length: Math.max(1, Math.ceil(trace.elapsed / 1000)) },
    (_, i) => ({
      time: i + 1,
      correct: 0,
      misses: 0,
      cumulative: 0,
      kpm: 0,
      missRate: 0,
    }),
  )
  for (const s of trace.strokes) {
    const b = buckets[Math.min(buckets.length - 1, Math.floor(s.t / 1000))]
    if (s.correct) b.correct++
    else b.misses++
  }
  for (const [i, b] of buckets.entries()) {
    cumulative += b.misses
    b.cumulative = cumulative
    b.kpm =
      (b.correct * 60000) /
      Math.max(1, Math.min(1000, trace.elapsed - i * 1000))
    b.missRate = (b.misses / Math.max(1, b.correct + b.misses)) * 100
  }
  const prompts = trace.prompts.map((p, i) => {
    const strokes = trace.strokes.filter((s) => s.prompt === i)
    const correct = strokes.filter((s) => s.correct).length
    const misses = strokes.length - correct
    return {
      ...p,
      index: i,
      correct,
      misses,
      kpm: (correct * 60000) / Math.max(1, p.end - p.start),
      loss:
        strokes.reduce((n, s) => n + loss(s), 0) +
        Math.max(0, p.end - (strokes.at(-1)?.t ?? p.start) - baseline),
    }
  })
  return { baseline, characters, buckets, prompts }
}

/** Treat stored optional detail as untrusted; malformed detail must not break history. */
export function validTrace(value: unknown): value is SessionTrace {
  if (!value || typeof value !== 'object') return false
  const v = value as SessionTrace
  const nonnegative = (n: unknown) =>
    typeof n === 'number' && Number.isFinite(n) && n >= 0
  if (
    v.version !== 1 ||
    !nonnegative(v.elapsed) ||
    !Array.isArray(v.prompts) ||
    !Array.isArray(v.strokes)
  )
    return false
  if (
    !v.prompts.every(
      (p) =>
        p &&
        typeof p.text === 'string' &&
        typeof p.reading === 'string' &&
        (p.wordStarts === undefined ||
          (Array.isArray(p.wordStarts) &&
            p.wordStarts.every(
              (offset, index, offsets) =>
                Number.isInteger(offset) &&
                offset > 0 &&
                offset < p.text.length &&
                (index === 0 || offset > offsets[index - 1]),
            ))) &&
        nonnegative(p.start) &&
        nonnegative(p.end) &&
        p.start <= p.end &&
        p.end <= v.elapsed,
    )
  )
    return false
  let previous = 0
  return v.strokes.every((s) => {
    if (
      !s ||
      !nonnegative(s.t) ||
      s.t < previous ||
      s.t > v.elapsed ||
      !nonnegative(s.dt) ||
      !Number.isInteger(s.prompt) ||
      s.prompt < 0 ||
      s.prompt >= v.prompts.length ||
      !Number.isInteger(s.position) ||
      s.position < 0 ||
      typeof s.correct !== 'boolean' ||
      !['key', 'expected', 'character'].every(
        (k) => typeof s[k as keyof Stroke] === 'string',
      )
    )
      return false
    previous = s.t
    return true
  })
}
