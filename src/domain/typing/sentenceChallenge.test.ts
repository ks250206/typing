import { expect, it } from 'vite-plus/test'
import {
  defaultSentenceGoals,
  normalizeSentenceGoals,
  judgeSentence,
} from './sentenceChallenge'

it('judges only after all repetitions using total active time and raw mistakes', () => {
  for (let completed = 1; completed < 5; completed++) {
    expect(
      judgeSentence(defaultSentenceGoals, completed, {
        keys: 30,
        elapsed: 6000,
        rawMisses: 10,
      }).outcome,
    ).toBe('pending')
  }
  expect(
    judgeSentence(defaultSentenceGoals, 0, {
      keys: 0,
      elapsed: 100,
      rawMisses: 11,
    }).outcome,
  ).toBe('failed')
  const total = { keys: 150, elapsed: 15000, rawMisses: 10 }
  expect(judgeSentence(defaultSentenceGoals, 5, total).outcome).toBe('passed')
  expect(
    judgeSentence(defaultSentenceGoals, 5, { ...total, elapsed: 15001 })
      .outcome,
  ).toBe('failed')
  expect(
    judgeSentence(defaultSentenceGoals, 5, { ...total, rawMisses: 11 })
      .accuracyPassed,
  ).toBe(false)
})
it('uses weighted total KPM rather than the average of per-repetition speeds and never rounds a failure up', () => {
  const goals = { targetKpm: 600, maxMisses: 2, repetitions: 2 }
  const result = judgeSentence(goals, 2, {
    keys: 60,
    elapsed: 10000,
    rawMisses: 0,
  })
  expect(result.kpm).toBe(360)
  expect(result.outcome).toBe('failed')
  expect(
    judgeSentence(goals, 2, { keys: 10, elapsed: 1001, rawMisses: 0 }).outcome,
  ).toBe('failed')
  expect(
    judgeSentence(goals, 2, { keys: 10, elapsed: 1000, rawMisses: 2 }).outcome,
  ).toBe('passed')
  expect(
    judgeSentence(goals, 2, { keys: 10, elapsed: 1000, rawMisses: 3 }).outcome,
  ).toBe('failed')
})
it('rejects malformed, fractional and out-of-range goals with explicit defaults', () => {
  expect(
    normalizeSentenceGoals({ targetKpm: NaN, maxMisses: -1, repetitions: 0 }),
  ).toEqual(defaultSentenceGoals)
  expect(
    normalizeSentenceGoals({
      targetKpm: Infinity,
      maxMisses: 1.5,
      repetitions: 51,
    }),
  ).toEqual(defaultSentenceGoals)
  expect(
    normalizeSentenceGoals({
      targetKpm: 3000,
      maxMisses: 100,
      repetitions: 50,
    }),
  ).toEqual({ targetKpm: 3000, maxMisses: 100, repetitions: 50 })
})
