import { expect, it } from 'vitest'
import {
  defaultSentenceGoals,
  normalizeSentenceGoals,
  judgeSentence,
} from './sentenceChallenge'

it('requires five consecutive successes by default and resets the streak after either failure', () => {
  let streak = 0
  const good = { keys: 30, elapsed: 6000, rawMisses: 0 }
  for (let i = 1; i <= 5; i++) {
    const result = judgeSentence(defaultSentenceGoals, streak, good)
    expect(result.streak).toBe(i)
    expect(result.cleared).toBe(i === 5)
    streak = result.streak
  }
  expect(
    judgeSentence(defaultSentenceGoals, 4, { ...good, elapsed: 12000 }).streak,
  ).toBe(0)
  expect(
    judgeSentence(defaultSentenceGoals, 4, { ...good, rawMisses: 1 }).streak,
  ).toBe(0)
})
it('judges exact speeds and raw wrong keystrokes, not rounded KPM or miss episodes', () => {
  expect(
    judgeSentence(defaultSentenceGoals, 0, {
      keys: 3,
      elapsed: 1001,
      rawMisses: 0,
    }).passed,
  ).toBe(false)
  expect(
    judgeSentence(defaultSentenceGoals, 0, {
      keys: 3,
      elapsed: 1000,
      rawMisses: 0,
    }).passed,
  ).toBe(true)
  const goals = { targetKpm: 180, maxMisses: 2, repetitions: 1 }
  expect(
    judgeSentence(goals, 0, { keys: 3, elapsed: 1000, rawMisses: 2 }).cleared,
  ).toBe(true)
  expect(
    judgeSentence(goals, 0, { keys: 3, elapsed: 1000, rawMisses: 3 })
      .accuracyPassed,
  ).toBe(false)
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
