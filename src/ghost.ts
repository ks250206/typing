import type { RecordEntry } from './storage'
import type { SessionTrace } from './telemetry'
import { TypingTrace } from './telemetry'
import { ReplayTimeline, remaining, replayEngine } from './replay'
import { MissEpisodes, scorePoint, typingTitle } from './scoring'

/** Race to the actual recorded endpoints, including unfinished CPU/trainer prompts.
 * Natural distance ignores redundant roman variants; only playback uses recorded keys.
 */
export class GhostRace {
  readonly source: RecordEntry
  readonly timeline: ReplayTimeline
  readonly goals: {
    prompt: number
    remaining: number
    distance: number
    complete: boolean
  }[]
  readonly finishTime: number
  readonly distance: number
  readonly trace = new TypingTrace()
  readonly misses = new MissEpisodes()
  engine: ReturnType<typeof replayEngine>
  index = 0
  typed = ''
  correct = 0
  elapsed = 0
  finished = false
  lastMistake = -Infinity
  constructor(source: RecordEntry, trace: SessionTrace) {
    this.source = source
    this.timeline = new ReplayTimeline(trace, source.layout, source.strokeLimit)
    this.goals = trace.prompts.flatMap((_, prompt) => {
      const start = this.timeline.initial[prompt]
      const end = this.timeline.ends[prompt]
      const final =
        end > this.timeline.starts[prompt]
          ? this.timeline.frames[end - 1]
          : start
      const distance = start.remaining - final.remaining
      return distance > 0
        ? [
            {
              prompt,
              remaining: final.remaining,
              distance,
              complete: final.done,
            },
          ]
        : []
    })
    if (!this.goals.length || trace.elapsed <= 0)
      throw Error('このログには対戦できる入力の到達地点がありません。')
    this.distance = this.goals.reduce((n, g) => n + g.distance, 0)
    const last = this.goals[this.goals.length - 1]
    const start = this.timeline.starts[last.prompt]
    const finish = this.timeline.frames.findIndex(
      (frame, i) =>
        i >= start &&
        i < this.timeline.ends[last.prompt] &&
        (last.complete ? frame.done : frame.remaining <= last.remaining),
    )
    this.finishTime = trace.strokes[finish].t
    this.engine = this.nextEngine()
    this.trace.begin(this.sentence, 0, source.layout)
  }
  private nextEngine() {
    return replayEngine(
      this.sentence,
      this.source.layout,
      this.source.strokeLimit,
    )
  }
  get goal() {
    return this.goals[this.index]
  }
  get sentence() {
    return this.timeline.sentences[this.goal.prompt]
  }
  advance(time: number) {
    if (!this.finished) this.elapsed = Math.max(this.elapsed, time)
  }
  feed(key: string, time: number) {
    if (this.finished) return false
    this.advance(time)
    const position = this.engine.position
    const expected =
      this.source.layout === 'kana'
        ? this.engine.target[position]
        : this.engine.hint[0]
    const accepted = this.engine.feed(key)
    this.trace.add(key, expected, position, accepted, this.elapsed)
    if (!accepted) {
      this.misses.miss()
      this.lastMistake = this.elapsed
      return false
    }
    this.correct++
    this.misses.accept()
    this.typed += key
    if (
      this.goal.complete
        ? this.engine.done
        : remaining(this.engine) <= this.goal.remaining
    ) {
      if (this.index === this.goals.length - 1) this.finished = true
      else {
        this.index++
        this.engine = this.nextEngine()
        this.typed = ''
        this.trace.begin(this.sentence, this.elapsed, this.source.layout)
      }
    }
    return true
  }
  get playerDistance() {
    if (this.finished) return this.distance
    return (
      this.goals.slice(0, this.index).reduce((n, g) => n + g.distance, 0) +
      Math.max(
        0,
        Math.min(
          this.goal.distance,
          this.timeline.initial[this.goal.prompt].remaining -
            remaining(this.engine),
        ),
      )
    )
  }
  ghost(time = this.elapsed, beforeStart = false) {
    return this.timeline.at(time, beforeStart ? 0 : undefined)
  }
  ghostDistance(time = this.elapsed) {
    const frame = this.ghost(time)
    return this.goals.reduce(
      (n, g) =>
        n +
        (g.prompt < frame.prompt
          ? g.distance
          : g.prompt === frame.prompt
            ? Math.max(
                0,
                Math.min(
                  g.distance,
                  this.timeline.initial[g.prompt].remaining - frame.remaining,
                ),
              )
            : 0),
      0,
    )
  }
  get result() {
    // Finishing at the source's last meaningful key beats its trailing idle time.
    return this.elapsed < this.finishTime
      ? 'YOU WIN'
      : this.elapsed > this.finishTime
        ? 'GHOST WIN'
        : 'DRAW'
  }
  get scoredKeys() {
    return this.source.strokeLimit ? this.distance : this.correct
  }
  get point() {
    return scorePoint(this.scoredKeys, this.misses.penalty, this.elapsed)
  }
  get rank() {
    return typingTitle(this.point, this.correct, this.misses.raw)
  }
  record(): RecordEntry {
    if (!this.finished) throw Error('未完了の対戦は保存しません。')
    const keys = this.scoredKeys
    const point = this.point
    return {
      id: crypto.randomUUID(),
      passageId: this.source.passageId,
      title: `ゴースト対戦 · ${this.source.title.replace(/^ゴースト対戦 · /, '')}`,
      layout: this.source.layout,
      date: new Date().toISOString(),
      elapsed: this.elapsed,
      keys,
      actualKeys: this.correct,
      misses: this.misses.misses,
      rawMisses: this.misses.raw,
      missPenalty: this.misses.penalty,
      point,
      rank: this.rank,
      kpm: Math.round((keys * 60000) / Math.max(1, this.elapsed)),
      accuracy:
        (this.correct / Math.max(1, this.correct + this.misses.raw)) * 100,
      scoreVersion: 3,
      mode: 'ghost',
      ghostSourceId: this.source.ghostSourceId ?? this.source.id,
      seed: this.source.seed,
      replayVersion: this.source.replayVersion,
      strokeLimit: this.source.strokeLimit,
      trace: this.trace.finish(this.elapsed),
    }
  }
}
