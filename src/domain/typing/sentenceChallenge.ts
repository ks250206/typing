export interface SentenceGoals {
  targetKpm: number
  maxMisses: number
  repetitions: number
}
export const defaultSentenceGoals: SentenceGoals = {
  targetKpm: 600,
  maxMisses: 10,
  repetitions: 5,
}
export function normalizeSentenceGoals(
  value: Partial<SentenceGoals>,
): SentenceGoals {
  const integer = (
    value: unknown,
    low: number,
    high: number,
    fallback: number,
  ) =>
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= low &&
    value <= high
      ? value
      : fallback
  return {
    targetKpm: integer(
      value.targetKpm,
      10,
      3000,
      defaultSentenceGoals.targetKpm,
    ),
    maxMisses: integer(value.maxMisses, 0, 100, defaultSentenceGoals.maxMisses),
    repetitions: integer(
      value.repetitions,
      1,
      50,
      defaultSentenceGoals.repetitions,
    ),
  }
}
/** Judge exact speed before rounding; every wrong physical keystroke counts. */
export function judgeSentence(
  goals: SentenceGoals,
  streak: number,
  result: { keys: number; elapsed: number; rawMisses: number },
) {
  const kpm = (result.keys * 60000) / Math.max(1, result.elapsed)
  const speedPassed = kpm >= goals.targetKpm
  const accuracyPassed = result.rawMisses <= goals.maxMisses
  const passed = speedPassed && accuracyPassed
  const nextStreak = passed ? Math.min(goals.repetitions, streak + 1) : 0
  return {
    kpm,
    speedPassed,
    accuracyPassed,
    passed,
    streak: nextStreak,
    cleared: nextStreak === goals.repetitions,
  }
}
