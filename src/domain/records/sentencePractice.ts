import type { RecordEntry } from './types'
import type { Sentence } from '../content/sentences'
import type { Layout } from '../typing/engine'
import { scorePoint, typingTitle } from '../typing/scoring'
import type { SessionTrace } from './telemetry'

export interface SentenceWordStats {
  best: number
  kpm: number
  elapsed: number
  tries: number
  keys: number
  misses: number
}
export type SentenceStats = Record<string, SentenceWordStats>
export const sentenceStatsKey = (
  id: string,
  layout: Layout,
  sentence: Sentence,
) => JSON.stringify([id, layout, sentence.text, sentence.reading])

export function updateSentenceStats(
  previous: SentenceWordStats | undefined,
  record: RecordEntry,
): SentenceWordStats {
  const keys = record.actualKeys ?? record.keys
  const kpm = (keys * 60000) / Math.max(1, record.elapsed)
  return {
    best: Math.max(previous?.best ?? 0, kpm),
    kpm,
    elapsed: record.elapsed,
    tries: (previous?.tries ?? 0) + 1,
    keys,
    misses: record.rawMisses ?? record.misses,
  }
}

/** Concatenate completed trials, preserving their active-time clocks. */
export function sentenceChallengeResult(
  records: RecordEntry[],
  title: string,
): RecordEntry | null {
  if (!records.length) return null
  const last = records.at(-1)!
  let elapsed = 0,
    keys = 0,
    misses = 0,
    rawMisses = 0,
    penalty = 0
  const trace: SessionTrace = {
    version: 1,
    elapsed: 0,
    prompts: [],
    strokes: [],
  }
  for (const record of records) {
    const promptOffset = trace.prompts.length
    if (record.trace) {
      trace.prompts.push(
        ...record.trace.prompts.map((p) => ({
          ...p,
          start: p.start + elapsed,
          end: p.end + elapsed,
        })),
      )
      trace.strokes.push(
        ...record.trace.strokes.map((s) => ({
          ...s,
          t: s.t + elapsed,
          prompt: s.prompt + promptOffset,
        })),
      )
    }
    elapsed += record.elapsed
    keys += record.actualKeys ?? record.keys
    misses += record.misses
    rawMisses += record.rawMisses ?? record.misses
    penalty += record.missPenalty ?? record.misses
  }
  trace.elapsed = elapsed
  const point = scorePoint(keys, penalty, elapsed)
  return {
    id: `challenge-${last.id}`,
    passageId: last.passageId,
    title,
    layout: last.layout,
    date: last.date,
    elapsed,
    keys,
    actualKeys: keys,
    misses,
    rawMisses,
    missPenalty: penalty,
    kpm: Math.round((keys * 60000) / Math.max(1, elapsed)),
    accuracy: keys ? (keys * 100) / (keys + rawMisses) : 100,
    point,
    rank: typingTitle(point, keys, rawMisses),
    scoreVersion: 3,
    mode: 'weak',
    trace,
  }
}
