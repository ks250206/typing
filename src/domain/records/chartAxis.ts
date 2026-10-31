/** Major labels every 100, with unlabeled half-step ticks; plots share this rounded maximum. */
export function chartAxis(maximum: number) {
  const max = Math.max(
    100,
    Math.ceil((Number.isFinite(maximum) ? maximum : 0) / 100) * 100,
  )
  return {
    max,
    ticks: Array.from({ length: max / 50 + 1 }, (_, index) => ({
      value: index * 50,
      major: index % 2 === 0,
    })),
  }
}
