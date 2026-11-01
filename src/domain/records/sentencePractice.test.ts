import { expect, it } from 'vitest'
import {
  sentenceChallengeResult,
  sentenceStatsKey,
  updateSentenceStats,
} from './sentencePractice'
import { englishSentence } from '../content/english'
import { sentenceEngine } from '../typing/sentenceEngine'
import { TypingTrace, validTrace } from './telemetry'
import { ReplayTimeline } from './replay'
import type { RecordEntry } from './types'

function attempt(id: string, elapsed: number, mistake = false): RecordEntry {
  const sentence = englishSentence('Hi.')
  const engine = sentenceEngine(sentence, 'jis')
  const trace = new TypingTrace()
  trace.begin(sentence, 0, 'jis')
  if (mistake) trace.add('h', 'H', 0, false, 10)
  let time = 50
  for (const key of sentence.text) {
    const position = engine.position
    const expected = engine.hint[0]
    trace.add(key, expected, position, engine.feed(key), (time += 50))
  }
  return {
    id,
    passageId: 'sentence-en-library',
    title: 'English',
    layout: 'jis',
    date: '2026-11-01',
    elapsed,
    keys: 3,
    actualKeys: 3,
    misses: Number(mistake),
    rawMisses: Number(mistake),
    missPenalty: Number(mistake),
    kpm: 0,
    accuracy: 100,
    trace: trace.finish(elapsed),
  }
}
it('aggregates every trial on one active-time timeline and replays exact English case', () => {
  const records = [attempt('first', 1000), attempt('second', 500, true)]
  const before = JSON.stringify(records)
  const result = sentenceChallengeResult(records, '一文練習')!
  expect(result.elapsed).toBe(1500)
  expect(result.keys).toBe(6)
  expect(result.rawMisses).toBe(1)
  expect(result.kpm).toBe(240)
  expect(result.trace?.prompts).toHaveLength(2)
  expect(result.trace!.prompts[1].start).toBe(1000)
  expect(validTrace(result.trace)).toBe(true)
  const timeline = new ReplayTimeline(result.trace!, 'jis')
  expect(timeline.at(1500).typed).toBe('Hi.')
  expect(timeline.at(1500).done).toBe(true)
  expect(JSON.stringify(records)).toBe(before)
  expect(sentenceChallengeResult([], 'empty')).toBeNull()
})
it('retains the best speed while counting every completed trial and separates layouts and exact words', () => {
  let stats = updateSentenceStats(undefined, attempt('a', 1000))
  stats = updateSentenceStats(stats, attempt('b', 500, true))
  stats = updateSentenceStats(stats, attempt('c', 2000))
  expect(stats).toEqual({
    best: 360,
    kpm: 90,
    elapsed: 2000,
    keys: 3,
    misses: 0,
    tries: 3,
  })
  const sentence = englishSentence('Hi.')
  expect(sentenceStatsKey('en-library', 'jis', sentence)).not.toBe(
    sentenceStatsKey('en-library', 'us', sentence),
  )
  expect(sentenceStatsKey('en-library', 'jis', sentence)).not.toBe(
    sentenceStatsKey('en-library', 'jis', englishSentence('hi.')),
  )
})

it('counts an interrupted trial without promoting its incomplete speed to a personal best', () => {
  const previous = updateSentenceStats(undefined, attempt('complete', 1000))
  const partial = updateSentenceStats(previous, attempt('partial', 100), false)
  expect(partial.tries).toBe(2)
  expect(partial.kpm).toBe(1800)
  expect(partial.best).toBe(previous.best)
  const allMisses = {
    ...attempt('all-misses', 1000),
    keys: 0,
    actualKeys: 0,
    misses: 1,
    rawMisses: 3,
  }
  expect(sentenceChallengeResult([allMisses], 'early stop')!.accuracy).toBe(0)
  expect(sentenceChallengeResult([allMisses], 'early stop')!.misses).toBe(3)
})
