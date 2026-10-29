import { expect, it } from 'vitest'
import {
  migrateCpuPreset,
  cpuPresets,
  cpuCharacters,
  cpuDuration,
  RtcMatch,
  roundWinner,
} from './cpuMatch'
import { animalRanks } from './scoring'
import { RomanEngine } from './engine'
import { battlePrompts, shuffledPrompts } from './battlePrompts'
const short = {
  text: 'あ',
  reading: 'あ',
  segments: [{ text: 'あ', reading: 'あ' }],
}
const config = { kpm: 300, reactionMs: 300, curve: 'constant' as const }
it('waits for visual reaction and models acceleration as a cumulative curve', () => {
  expect(cpuCharacters(299, config)).toBe(0)
  expect(cpuCharacters(300, config)).toBe(1)
  expect(cpuCharacters(500, config)).toBe(2)
  expect(cpuCharacters(1000, { ...config, curve: 'ease-in' })).toBeLessThan(
    cpuCharacters(1000, config),
  )
  for (const curve of ['constant', 'ease-in'] as const)
    expect(
      cpuCharacters(cpuDuration(30, { ...config, curve }), {
        ...config,
        curve,
      }),
    ).toBeCloseTo(30, 8)
})
it('verifies original prompts and a shuffle preserves the entire pool', () => {
  expect(
    shuffledPrompts(() => 0.5)
      .map((p) => p.text)
      .sort(),
  ).toEqual(battlePrompts.map((p) => p.text).sort())
  for (const prompt of battlePrompts) {
    expect(prompt.segments.map((s) => s.text).join('')).toBe(prompt.text)
    const e = new RomanEngine(prompt.reading)
    for (const k of e.hint) expect(e.feed(k)).toBe(true)
    expect(e.done).toBe(true)
  }
})
it('starts both sides simultaneously and rejects countdown/stale carryover input', () => {
  const match = new RtcMatch([short], 'jis', config)
  expect(match.feed('a', 2999)).toBe(false)
  match.advance(3000)
  expect(match.phase).toBe('playing')
  expect(match.feed('a', 3100)).toBe(true)
  expect(match.roundPlayer).toBe(1)
  match.feed('a', 3200)
  expect(match.roundPlayer).toBe(1)
  match.feed('a', 5000)
  expect(match.roundPlayer).toBe(1)
})
it('credits the CPU by its deadline even when the frame/event arrives late', () => {
  const match = new RtcMatch([short], 'jis', config)
  match.feed('a', 3501)
  expect(match.roundCpu).toBe(1)
  expect(match.roundPlayer).toBe(0)
  const frozen = match.elapsedInWord(9000)
  expect(frozen).toBeCloseTo(300)
})
it('applies the 95% round reversal and BO7 majority independently of point speed', () => {
  expect(roundWinner('player', 0.949)).toBe('cpu')
  expect(roundWinner('player', 0.95)).toBe('player')
  expect(roundWinner('cpu', 0.99, 0.94)).toBe('player')
  expect(roundWinner('player', 0.94, 0.94)).toBe('player')
  const match = new RtcMatch([short], 'jis', config)
  let now = 3000
  match.advance(now)
  for (let round = 0; round < 4; round++) {
    for (let word = 0; word < 10; word++) {
      if (word > 0) {
        now = match.deadline
        match.advance(now)
      }
      if (round === 0 && word === 0) {
        match.feed('z', now + 1)
        match.feed('z', now + 2)
      }
      now += 10
      match.feed('a', now)
    }
    if (round === 0) {
      expect(match.lastRound).toBe('cpu')
      expect(match.accuracyReversal).toBe(true)
    }
    if (round < 3) {
      match.nextRound(now)
      now = match.deadline
      match.advance(now)
    }
  }
  expect(match.roundsPlayer).toBe(3)
  expect(match.roundsCpu).toBe(1)
  expect(match.phase).toBe('round-result')
})
it('finishes exactly at four rounds and never awards another point after finish', () => {
  const match = new RtcMatch([short], 'kana', config)
  let now = 0
  for (let round = 0; round < 4; round++) {
    match.advance(match.deadline)
    now = match.wordStart
    for (let word = 0; word < 10; word++) {
      now += 10
      match.feed('あ', now)
      if (word < 9) {
        now = match.deadline
        match.advance(now)
      }
    }
    if (round < 3) match.nextRound(now)
  }
  expect(match.phase).toBe('finished')
  expect(match.roundsPlayer).toBe(4)
  match.feed('あ', now + 10000)
  match.advance(now + 20000)
  expect(match.roundPlayer).toBe(10)
})
it('pause/resume never advances the clock or reveals a countdown prompt', () => {
  const match = new RtcMatch([short], 'jis', config)
  match.pause()
  match.advance(100000)
  expect(match.phase).toBe('paused')
  expect(match.awaitingStart).toBe(true)
  match.resume()
  match.advance(3000)
  match.pause()
  match.feed('a', 3100)
  expect(match.roundPlayer).toBe(0)
  match.resume()
  match.feed('a', 3100)
  expect(match.roundPlayer).toBe(1)
})

it('offers exactly one CPU per rank at the band upper bound minus 15, with smooth 250–120ms reactions', () => {
  expect(cpuPresets).toHaveLength(animalRanks.length)
  expect(cpuPresets.map((p) => p.name)).toEqual(animalRanks.map((r) => r[1]))
  cpuPresets.forEach((p, index) => {
    const upper = animalRanks[index + 1]?.[0] ?? 1050
    expect(p.kpm).toBe(upper - 15)
    expect(p.reactionMs).toBe(Math.round(250 - (130 * index) / 20))
    if (index)
      expect(p.reactionMs).toBeLessThan(cpuPresets[index - 1].reactionMs)
  })
  expect(cpuPresets[0]).toMatchObject({
    name: 'カメ',
    kpm: 35,
    reactionMs: 250,
  })
  expect(cpuPresets.at(-1)).toMatchObject({
    name: 'チーター',
    kpm: 1035,
    reactionMs: 120,
  })
})
it('migrates exact legacy presets, preserves custom values and leaves new profiles stable', () => {
  expect(
    migrateCpuPreset({ kpm: 300, reactionMs: 280, curve: 'ease-in' }),
  ).toEqual(cpuPresets.find((p) => p.name === 'ネコ'))
  expect(
    migrateCpuPreset({ kpm: 300, reactionMs: 210, curve: 'ease-in' }),
  ).toEqual(cpuPresets.find((p) => p.name === 'ネコ'))
  expect(
    migrateCpuPreset({ kpm: 1200, reactionMs: 260, curve: 'constant' }),
  ).toEqual(cpuPresets.at(-1))
  const custom = { kpm: 300, reactionMs: 1000, curve: 'ease-in' as const }
  expect(migrateCpuPreset(custom)).toBe(custom)
  for (const p of cpuPresets) expect(migrateCpuPreset(p)).toEqual(p)
})
