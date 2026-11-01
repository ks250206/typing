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
/** Judge the complete repetition set by total active time and total raw mistakes. */
export function judgeSentence(
  goals: SentenceGoals,
  completed: number,
  result: { keys: number; elapsed: number; rawMisses: number },
) {
  const kpm = (result.keys * 60000) / Math.max(1, result.elapsed)
  const complete = completed >= goals.repetitions
  const speedPassed = complete ? kpm >= goals.targetKpm : null
  const accuracyPassed = result.rawMisses <= goals.maxMisses
  if (!accuracyPassed)
    return {
      outcome: 'failed' as const,
      kpm,
      speedPassed,
      accuracyPassed: false,
    }
  if (!complete)
    return {
      outcome: 'pending' as const,
      kpm,
      speedPassed: null,
      accuracyPassed: null,
    }
  return {
    outcome:
      speedPassed && accuracyPassed ? ('passed' as const) : ('failed' as const),
    kpm,
    speedPassed,
    accuracyPassed,
  }
}
