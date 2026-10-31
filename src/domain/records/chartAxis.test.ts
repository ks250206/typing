import { expect, it } from 'vitest'
import { chartAxis } from './chartAxis'
it.each([
  [0, 100],
  [1, 100],
  [240, 300],
  [400, 400],
  [401, 500],
  [NaN, 100],
])('rounds %s to %s and labels only 100-step ticks', (maximum, expected) => {
  const axis = chartAxis(maximum)
  expect(axis.max).toBe(expected)
  expect(axis.ticks.filter((t) => t.major).map((t) => t.value)).toEqual(
    Array.from({ length: expected / 100 + 1 }, (_, i) => i * 100),
  )
  expect(axis.ticks.filter((t) => !t.major).map((t) => t.value)).toEqual(
    Array.from({ length: expected / 100 }, (_, i) => i * 100 + 50),
  )
})
