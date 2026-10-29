import type { Passage } from '../content/passages'
import type { Layout } from '../typing/engine'
import { MissEpisodes, scorePoint, typingTitle } from '../typing/scoring'
import type { SessionTrace } from './telemetry'
import type { RecordEntry } from './types'

export function practiceResult({
  id,
  passage,
  layout,
  duration,
  durationMs,
  nextKeys,
  typewell,
  trainer,
  etyping,
  rtc,
  articles,
  limit,
  seed,
  replayVersion,
  missEpisodes,
  trace,
  date,
}: {
  id: string
  passage: Passage
  layout: Layout
  duration: number
  durationMs: number
  nextKeys: number
  typewell: boolean
  trainer: boolean
  etyping: boolean
  rtc: boolean
  articles: boolean
  limit: number
  seed: string
  replayVersion: 1 | 2
  missEpisodes: MissEpisodes
  trace: SessionTrace
  date: string
}): RecordEntry {
  const scoredKeys = typewell ? limit : nextKeys
  return {
    id,
    passageId: passage.id,
    title: passage.title,
    layout,
    date,
    elapsed: duration,
    keys: scoredKeys,
    actualKeys: nextKeys,
    misses: durationMs ? missEpisodes.raw : missEpisodes.misses,
    rawMisses: missEpisodes.raw,
    point: scorePoint(scoredKeys, missEpisodes.penalty, duration),
    rank: typingTitle(
      scorePoint(scoredKeys, missEpisodes.penalty, duration),
      nextKeys,
      missEpisodes.raw,
    ),
    scoreVersion: 3,
    missPenalty: missEpisodes.penalty,
    ...(typewell
      ? { seed, strokeLimit: limit, replayVersion }
      : trainer
        ? { seed, replayVersion }
        : etyping || rtc || articles
          ? { seed, replayVersion: 1 as const }
          : {}),
    mode: durationMs ? 'trainer' : 'practice',
    trace,
    kpm: Math.round(scoredKeys / (Math.max(duration, 1) / 60000)),
    accuracy: Number(
      (
        (nextKeys /
          (nextKeys + (durationMs ? missEpisodes.raw : missEpisodes.misses))) *
        100
      ).toFixed(2),
    ),
  }
}
