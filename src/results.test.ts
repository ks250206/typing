import { expect, it } from 'vitest'
import { RtcMatch } from './cpuMatch'
import { resultAnalysis } from './results'
import { validTrace } from './telemetry'
import { ReplayTimeline } from './replay'
const prompt = {
  text: 'あ',
  reading: 'あ',
  segments: [{ text: 'あ', reading: 'あ' }],
}
it('captures every round on its own clock, including raw misses and the 95% reversal, without changing aggregate scoring', () => {
  const m = new RtcMatch([prompt], 'jis', {
    kpm: 35,
    reactionMs: 250,
    curve: 'constant',
  })
  let now = 3000
  for (let round = 0; round < 5; round++) {
    m.advance(now)
    for (let word = 0; word < 10; word++) {
      if (word) {
        now = m.deadline
        m.advance(now)
      }
      if (round === 0 && word === 0) {
        m.feed('z', now + 1)
        m.feed('z', now + 2)
      }
      now += 10
      m.feed('a', now)
    }
    const r = m.roundResults[round]
    expect(r.keys).toBe(10)
    expect(r.trace.elapsed).toBe(r.elapsed)
    expect(r.trace.prompts).toHaveLength(10)
    expect(r.trace.prompts[0].start).toBe(0)
    expect(r.trace.strokes[0].prompt).toBe(0)
    expect(validTrace(r.trace)).toBe(true)
    expect(() => new ReplayTimeline(r.trace, 'jis')).not.toThrow()
    if (round < 4) {
      m.nextRound(now)
      now = m.deadline
    }
  }
  expect(m.phase).toBe('finished')
  expect(m.roundResults[0]).toMatchObject({
    winner: 'cpu',
    reversal: true,
    raw: 2,
    misses: 1,
  })
  expect(m.roundsPlayer).toBe(4)
  expect(m.roundsCpu).toBe(1)
  expect(m.totalKeys + m.keys).toBe(50)
  const full = m.trace.finish(m.totalElapsed)
  expect(full.prompts).toHaveLength(50)
  expect(full.strokes).toHaveLength(52)
  expect(m.roundResults.flatMap((r) => r.trace.strokes)).toHaveLength(52)
  const snapshot = JSON.stringify(m.roundResults)
  m.advance(now + 100000)
  m.nextRound(now + 100000)
  expect(JSON.stringify(m.roundResults)).toBe(snapshot)
})
it('groups mistakes by exact prompt, position, expected key and actual input, retaining real times and source logs', () => {
  const m = new RtcMatch([prompt], 'jis', {
    kpm: 35,
    reactionMs: 250,
    curve: 'constant',
  })
  m.advance(3000)
  m.feed('z', 3100)
  m.feed('z', 3150)
  m.feed('x', 3200)
  m.feed('a', 3300)
  m.advance(m.deadline)
  m.feed('z', m.wordStart + 20)
  const trace = m.trace.finish(m.totalElapsed + 30),
    before = JSON.stringify(trace)
  const result = resultAnalysis(trace)
  expect(result.mistakes).toHaveLength(3)
  expect(result.mistakes[0]).toMatchObject({
    prompt: 0,
    key: 'z',
    expected: 'a',
    count: 2,
    first: 100,
  })
  expect(result.mistakes.reduce((n, r) => n + r.count, 0)).toBe(4)
  expect(JSON.stringify(trace)).toBe(before)
})
it('keeps precise non-integer round boundaries valid for CPU wins with no human input', () => {
  const m = new RtcMatch([prompt], 'jis', {
    kpm: 385,
    reactionMs: 204.5,
    curve: 'ease-in',
  })
  m.advance(3000)
  for (let round = 0; round < 4; round++) {
    for (let word = 0; word < 10; word++) {
      m.advance(m.cpuDeadline + 0.01)
      if (word < 9) m.advance(m.deadline)
    }
    expect(validTrace(m.roundResults[round].trace)).toBe(true)
    if (round < 3) {
      m.nextRound(m.wordEnd + 1000)
      m.advance(m.deadline)
    }
  }
  expect(m.roundResults).toHaveLength(4)
  expect(m.roundsCpu).toBe(4)
})
