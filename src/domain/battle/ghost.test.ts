import { expect, it } from 'vitest'
import { GhostRace } from './ghost'
import { TypingTrace } from '../records/telemetry'
import type { SessionTrace } from '../records/telemetry'
import type { RecordEntry } from '../records/types'
import { replayEngine } from '../records/replay'
import { typewellDocument, typewellEngine } from '../content/typewell'
import type { Layout } from '../typing/engine'
import type { Sentence } from '../content/sentences'
const sentence = (text: string, reading = text): Sentence => ({
  text,
  reading,
  segments: [{ text, reading }],
})
const source: RecordEntry = {
  id: 'original',
  title: '検証',
  passageId: 'rtc-test',
  layout: 'jis',
  date: '2026-10-29T00:00:00Z',
  elapsed: 1200,
  keys: 4,
  misses: 1,
  kpm: 200,
  accuracy: 80,
  seed: 'same-seed',
  replayVersion: 1,
}
function log(
  sentences: Sentence[],
  inputs: string[],
  layout: Layout = 'jis',
): SessionTrace {
  const recorder = new TypingTrace()
  let time = 0
  sentences.forEach((s, index) => {
    const e = replayEngine(s, layout)
    recorder.begin(s, time, layout)
    for (const key of inputs[index]) {
      const position = e.position
      const expected = layout === 'kana' ? e.target[position] : e.hint[0]
      recorder.add(key, expected, position, e.feed(key), (time += 100))
    }
  })
  return recorder.finish(time + 300)
}
it('replays source spelling, misses and timing while an independent player can win with another valid spelling', () => {
  const trace = log([sentence('鹿', 'しか')], ['sizka'])
  const original = JSON.stringify(trace)
  const race = new GhostRace(source, trace)
  expect(race.ghost(200)).toMatchObject({ typed: 'si', misses: 0 })
  expect(race.ghost(300)).toMatchObject({
    typed: 'si',
    misses: 1,
    mistake: true,
  })
  expect(race.finishTime).toBe(500)
  for (const [i, key] of [...'shika'].entries()) race.feed(key, i * 60)
  expect(race.finished).toBe(true)
  expect(race.result).toBe('YOU WIN')
  expect(race.playerDistance).toBe(race.distance)
  const record = race.record()
  expect(record).toMatchObject({
    mode: 'ghost',
    ghostSourceId: source.id,
    seed: source.seed,
    layout: source.layout,
    keys: 5,
    actualKeys: 5,
    rawMisses: 0,
  })
  expect(record.trace?.strokes.map((s) => s.key).join('')).toBe('shika')
  expect(JSON.stringify(trace)).toBe(original)
  const finish = race.elapsed
  race.advance(5000)
  race.feed('z', 6000)
  expect(race.elapsed).toBe(finish)
  expect(race.correct).toBe(5)
})
it('compares meaningful reading distance rather than extra alternate roman keys', () => {
  const race = new GhostRace(
    source,
    log([sentence('参加', 'さんか')], ['sannka']),
  )
  for (const [i, key] of [...'sanka'].entries()) race.feed(key, i * 100)
  expect(race.finished).toBe(true)
  expect(race.playerDistance).toBe(5)
  expect(race.ghostDistance(600)).toBe(5)
})
it('counts player misses and never awards progress for a wrong key; handles loss and draw', () => {
  const trace = log([sentence('あ')], ['a'])
  const race = new GhostRace(source, trace)
  race.feed('z', 100)
  expect(race.playerDistance).toBe(0)
  expect(race.misses.raw).toBe(1)
  race.advance(500)
  expect(race.ghostDistance()).toBe(race.distance)
  race.feed('a', 600)
  expect(race.result).toBe('GHOST WIN')
  expect(race.record().rawMisses).toBe(1)
  const draw = new GhostRace(source, trace)
  draw.feed('a', 100)
  expect(draw.result).toBe('DRAW')
})
it('uses recorded prompt order and partial endpoints, skipping words with no meaningful progress', () => {
  const trace = log(
    [sentence('あ'), sentence('う'), sentence('しか')],
    ['a', 'z', 'si'],
  )
  const race = new GhostRace({ ...source, mode: 'cpu' }, trace)
  expect(race.goals.map((g) => g.prompt)).toEqual([0, 2])
  race.feed('a', 0)
  expect(race.sentence.reading).toBe('しか')
  race.feed('s', 100)
  race.feed('h', 200)
  expect(race.finished).toBe(false)
  race.feed('i', 300)
  expect(race.finished).toBe(true)
  expect(race.ghostDistance(1000)).toBe(race.distance)
  expect(race.record().trace?.prompts.map((p) => p.text)).toEqual([
    'あ',
    'しか',
  ])
})
it('supports voicing in kana and all supported roman layouts, preserving source layout', () => {
  for (const layout of [
    'jis',
    'us',
    'dvorak',
    'colemak',
    'workman',
    'onishi',
    'azerty',
    'norman',
    'nova-f5-pair',
    'kana',
  ] as const) {
    const input = layout === 'kana' ? 'か\u3099' : 'ga'
    const race = new GhostRace(
      { ...source, layout },
      log([sentence('蛾', 'が')], [input], layout),
    )
    for (const [i, key] of [...input].entries()) race.feed(key, i * 100)
    expect(race.finished).toBe(true)
    expect(race.record().layout).toBe(layout)
  }
})
it('preserves TypeWell fixed 400/280 endpoints for full and unfinished logs', () => {
  for (const layout of ['jis', 'kana'] as const) {
    const doc = typewellDocument('typewell-space', 'ghost', layout, 2)
    for (const complete of [true, false]) {
      const e = typewellEngine(doc.plan),
        recorder = new TypingTrace()
      recorder.begin(doc.sentences[0], 0, layout)
      let count = 0
      while (!e.done && (complete || count < 101)) {
        const pos = e.position,
          key = layout === 'kana' ? e.target[pos] : e.hint[0]
        recorder.add(key, key, pos, e.feed(key), ++count * 10)
      }
      const race = new GhostRace(
        { ...source, layout, strokeLimit: doc.plan.limit },
        recorder.finish(count * 10),
      )
      let i = 0
      while (!race.finished && i < 1000) {
        const key =
          layout === 'kana'
            ? race.engine.target[race.engine.position]
            : race.engine.hint[0]
        race.feed(key, ++i)
      }
      expect(race.finished).toBe(true)
      expect(race.correct).toBe(count)
      expect(race.playerDistance).toBe(race.distance)
      expect(race.record().keys).toBe(race.distance)
    }
  }
})
it('does not invent ghosts from empty or inconsistent logs, or save unfinished races', () => {
  expect(() => new GhostRace(source, log([sentence('あ')], ['z']))).toThrow(
    '到達地点',
  )
  const trace = log([sentence('あ')], ['a'])
  trace.strokes[0].correct = false
  expect(() => new GhostRace(source, trace)).toThrow('入力判定')
  const race = new GhostRace(source, log([sentence('あ')], ['a']))
  expect(() => race.record()).toThrow('未完了')
})
