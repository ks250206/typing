import { expect, it } from 'vitest'
import { animalRank, MissEpisodes, scorePoint } from './scoring'
it('uses unrounded speed and accuracy, with no point ceiling', () => {
  expect(scorePoint(300, 0, 60000)).toBe(300)
  expect(scorePoint(300, 100, 60000)).toBe(168)
  expect(scorePoint(1200, 0, 60000)).toBe(1200)
  expect(animalRank(1000)).toBe('チーター')
  expect(animalRank(2500)).toBe('チーター')
  expect(scorePoint(0, 0, 0)).toBe(0)
  expect(scorePoint(10, 0, 0)).toBe(0)
})
it('collapses consecutive wrong keys until the next accepted key, but retains raw errors', () => {
  const counter = new MissEpisodes()
  expect(counter.miss()).toBe(true)
  for (let i = 0; i < 8; i++) expect(counter.miss()).toBe(false)
  expect(counter.misses).toBe(1)
  expect(counter.raw).toBe(9)
  counter.accept()
  expect(counter.miss()).toBe(true)
  expect(counter.misses).toBe(2)
})

it('reduces the penalty of a miss streak while keeping a nonzero penalty from miss five onwards', () => {
  const counter = new MissEpisodes()
  const penalties = [1, 1.75, 2.25, 2.6, 2.85, 3.1, 3.35]
  for (const penalty of penalties) {
    counter.miss()
    expect(counter.penalty).toBe(penalty)
  }
  expect(counter.misses).toBe(1)
  expect(counter.raw).toBe(7)
  counter.accept()
  counter.miss()
  expect(counter.penalty).toBe(4.35)
  expect(scorePoint(300, 3.35, 60000)).toBeLessThan(scorePoint(300, 1, 60000))
})
