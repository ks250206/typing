import { expect, it } from 'vitest'
import { TypingTrace, analyzeTrace, validTrace } from './telemetry'
import { RtcMatch } from './cpuMatch'
const sentence = {
  text: 'あいうえ',
  reading: 'あいうえ',
  segments: [...'あいうえ'].map((text) => ({ text, reading: text })),
}
it('records every correct and mistaken key, exact intervals, per-second rates and stalls', () => {
  const recorder = new TypingTrace()
  recorder.begin(sentence, 0, 'jis')
  recorder.add('a', 'a', 0, true, 0)
  recorder.add('i', 'i', 1, true, 100)
  recorder.add('z', 'u', 2, false, 600)
  recorder.add('u', 'u', 2, true, 700)
  recorder.add('e', 'e', 3, true, 1600)
  const trace = recorder.finish(2000)
  expect(trace.strokes.map((s) => s.dt)).toEqual([0, 100, 500, 100, 900])
  expect(trace.strokes[2]).toMatchObject({
    character: 'う',
    correct: false,
    position: 2,
    key: 'z',
    expected: 'u',
  })
  const a = analyzeTrace(trace)
  expect(a.baseline).toBe(100)
  expect(a.buckets).toMatchObject([
    { kpm: 180, missRate: 25, cumulative: 1 },
    { kpm: 60, missRate: 0, cumulative: 1 },
  ])
  expect(a.characters[0]).toMatchObject({ character: 'え', loss: 800 })
  expect(a.prompts[0]).toMatchObject({
    loss: 1500,
    misses: 1,
    correct: 4,
    kpm: 120,
  })
})
it('keeps snapshots immutable, maps decomposed kana, and resets intervals on prompt changes', () => {
  const r = new TypingTrace()
  r.begin(
    { text: 'が', reading: 'が', segments: [{ text: 'が', reading: 'が' }] },
    0,
    'kana',
  )
  r.add('か', 'か', 0, true, 100)
  r.add('\u3099', '\u3099', 1, true, 200)
  const saved = r.finish(300)
  r.begin(sentence, 300, 'jis')
  r.add('a', 'a', 0, true, 500)
  expect(saved.strokes).toHaveLength(2)
  expect(saved.strokes.every((s) => s.character === 'が')).toBe(true)
  expect(r.finish(1000).strokes[2]).toMatchObject({
    dt: 200,
    t: 500,
    prompt: 1,
  })
})
it('attributes an entirely idle prompt to sentence delay and handles empty logs', () => {
  const r = new TypingTrace()
  r.begin(sentence, 0, 'jis')
  const a = analyzeTrace(r.finish(2000))
  expect(a.baseline).toBe(0)
  expect(a.prompts[0]).toMatchObject({
    loss: 2000,
    correct: 0,
    misses: 0,
    kpm: 0,
  })
  expect(
    a.buckets.every((b) => Number.isFinite(b.kpm) && b.cumulative === 0),
  ).toBe(true)
})
it('CPU recorder excludes countdowns and word-result gaps, preserving raw consecutive misses', () => {
  const match = new RtcMatch(
    [
      {
        text: 'あい',
        reading: 'あい',
        segments: [
          { text: 'あ', reading: 'あ' },
          { text: 'い', reading: 'い' },
        ],
      },
    ],
    'jis',
    { kpm: 60, reactionMs: 1500, curve: 'constant' },
  )
  match.advance(3000)
  match.feed('a', 3100)
  match.feed('z', 3200)
  match.feed('z', 3300)
  match.feed('i', 3400)
  match.advance(4050)
  match.feed('a', 4150)
  const trace = match.trace.finish(match.totalElapsed + 100)
  expect(trace.strokes.map((s) => s.t)).toEqual([100, 200, 300, 400, 500])
  expect(trace.strokes.filter((s) => !s.correct)).toHaveLength(2)
  expect(trace.prompts).toHaveLength(2)
  expect(trace.strokes.at(-1)?.dt).toBe(100)
})

it('rejects corrupted optional traces instead of crashing the record viewer', () => {
  const r = new TypingTrace()
  r.begin(sentence, 0, 'jis')
  r.add('a', 'a', 0, true, 100)
  const valid = r.finish(200)
  expect(validTrace(valid)).toBe(true)
  for (const value of [
    null,
    {},
    { ...valid, elapsed: Infinity },
    { ...valid, prompts: [null] },
    { ...valid, strokes: [{ ...valid.strokes[0], t: -1 }] },
    { ...valid, strokes: [{ ...valid.strokes[0], prompt: 10 }] },
  ])
    expect(validTrace(value)).toBe(false)
})
