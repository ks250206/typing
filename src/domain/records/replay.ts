import { KanaEngine, RomanEngine } from '../typing/engine'
import type { Layout } from '../typing/engine'
import type { SessionTrace, TracePrompt } from './telemetry'
import { validTrace } from './telemetry'
import type { ReadingSegment, Sentence } from '../content/sentences'
import { sentencesByPassage } from '../content/sentences'
import { planTypewell, typewellEngine } from '../content/typewell'

interface EngineFrame {
  position: number
  target: string
  typed: string
  hint: string
  done: boolean
  remaining: number
}
/** Legacy logs can use an exact existing alignment, or exact space-delimited word pairs. */
function displaySentence(p: TracePrompt): Sentence {
  let segments = p.segments
  const valid = (s: ReadingSegment[]) =>
    Array.isArray(s) &&
    s.every(
      (s) => !!s && typeof s.text === 'string' && typeof s.reading === 'string',
    ) &&
    s.map((s) => s.text).join('') === p.text &&
    s.map((s) => s.reading).join('') === p.reading
  if (segments && !valid(segments))
    throw Error('本文と読みの対応が壊れています。')
  if (!segments)
    segments = Object.values(sentencesByPassage)
      .flat()
      .find((s) => s.text === p.text && s.reading === p.reading)?.segments
  if (!segments && p.text.includes(' ')) {
    const text = p.text.match(/\S+| +/g) ?? [],
      reading = p.reading.match(/\S+| +/g) ?? []
    if (text.length === reading.length)
      segments = text.map((text, i) => ({ text, reading: reading[i] }))
  }
  return {
    ...(p.continuous === true ? { continuous: true } : {}),
    ...(typeof p.label === 'string' ? { label: p.label } : {}),
    text: p.text,
    reading: p.reading,
    segments: segments ?? [{ text: p.text, reading: p.reading }],
  }
}
function upperBound<T>(rows: T[], value: number, key: (r: T) => number) {
  let low = 0,
    high = rows.length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (key(rows[mid]) <= value) low = mid + 1
    else high = mid
  }
  return low
}
export function replayEngine(
  sentence: Sentence,
  layout: Layout,
  strokeLimit?: number,
) {
  return strokeLimit
    ? typewellEngine(planTypewell(sentence, layout))
    : layout === 'kana'
      ? new KanaEngine(sentence.reading)
      : new RomanEngine(sentence.reading)
}
export function remaining(engine: RomanEngine | KanaEngine) {
  return engine instanceof RomanEngine
    ? engine.naturalRemaining
    : engine.target.length - engine.position
}
/** Immutable event states; playback changes only the cursor, never the saved trace. */
export class ReplayTimeline {
  readonly sentences: Sentence[]
  readonly frames: EngineFrame[] = []
  readonly initial: EngineFrame[] = []
  readonly starts: number[] = []
  readonly ends: number[] = []
  readonly correct = [0]
  readonly misses = [0]
  readonly trace: SessionTrace
  readonly layout: Layout
  readonly strokeLimit?: number
  constructor(trace: SessionTrace, layout: Layout, strokeLimit?: number) {
    this.trace = trace
    this.layout = layout
    this.strokeLimit = strokeLimit
    if (!validTrace(trace) || !trace.prompts.length)
      throw Error('この打鍵ログは再生できません。')
    this.sentences = trace.prompts.map(displaySentence)
    let count = 0
    for (const [i, p] of trace.prompts.entries()) {
      if (i && p.start < trace.prompts[i - 1].end)
        throw Error('文章の時刻順序が壊れています。')
      const engine = replayEngine(this.sentences[i], layout, strokeLimit)
      if (strokeLimit && strokeLimit !== (layout === 'kana' ? 280 : 400))
        throw Error('基準打鍵数が一致しません。')
      let typed = ''
      const snapshot = () => ({
        position: engine.position,
        target: engine.target,
        typed,
        hint: engine.hint,
        done: engine.done,
        remaining: remaining(engine),
      })
      this.initial.push(snapshot())
      this.starts.push(count)
      while (
        count < trace.strokes.length &&
        trace.strokes[count].prompt === i
      ) {
        const s = trace.strokes[count]
        if (s.t < p.start || s.t > p.end || s.position !== engine.position)
          throw Error('保存された入力位置を再現できません。')
        const accepted = engine.feed(s.key)
        if (accepted !== s.correct)
          throw Error('保存時と入力判定が異なるため再生を停止しました。')
        if (accepted) typed += s.key
        this.frames.push(snapshot())
        this.correct.push(this.correct[count] + Number(s.correct))
        this.misses.push(this.misses[count] + Number(!s.correct))
        count++
      }
      this.ends.push(count)
    }
    if (count !== trace.strokes.length)
      throw Error('打鍵の文章順序が壊れています。')
  }
  countAt(time: number) {
    return upperBound(this.trace.strokes, time, (s) => s.t)
  }
  at(time: number, exactCount?: number) {
    const t = Math.max(0, Math.min(this.trace.elapsed, time))
    const count =
      exactCount === undefined
        ? this.countAt(t)
        : Math.max(0, Math.min(exactCount, this.trace.strokes.length))
    const prompt =
      exactCount !== undefined && count > 0
        ? this.trace.strokes[count - 1].prompt
        : Math.max(0, upperBound(this.trace.prompts, t, (p) => p.start) - 1)
    const index = Math.min(count, this.ends[prompt]) - 1
    const frame =
      index >= this.starts[prompt] ? this.frames[index] : this.initial[prompt]
    const last = count ? this.trace.strokes[count - 1] : undefined
    const from = Math.min(
      count,
      upperBound(this.trace.strokes, t - 1000, (s) => s.t),
    )
    return {
      ...frame,
      time: t,
      count,
      prompt,
      sentence: this.sentences[prompt],
      correct: this.correct[count],
      misses: this.misses[count],
      last,
      kpm: t > 0 ? (this.correct[count] * 60000) / t : 0,
      recentKpm:
        t > 0
          ? ((this.correct[count] - this.correct[from]) * 60000) /
            Math.max(1, Math.min(1000, t))
          : 0,
      mistake:
        !!last && !last.correct && last.prompt === prompt && t - last.t <= 180,
    }
  }
}
