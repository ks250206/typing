import { expect, it } from 'vitest'
import { TypingTrace } from './telemetry'
import { ReplayTimeline } from './replay'
import { RomanEngine, KanaEngine } from '../typing/engine'
import { typewellDocument, typewellEngine } from '../content/typewell'
const sentence = {
  text: 'しんか',
  reading: 'しんか',
  segments: [...'しんか'].map((text) => ({ text, reading: text })),
}
it('replays actual alternative spellings and misses at exact timestamps without modifying the log', () => {
  const r = new TypingTrace(),
    e = new RomanEngine(sentence.reading)
  r.begin(sentence, 0, 'jis')
  for (const [i, key] of [...'sinnzka'].entries()) {
    const pos = e.position,
      expected = e.hint[0]
    r.add(key, expected, pos, e.feed(key), (i + 1) * 100)
  }
  const trace = r.finish(900),
    before = JSON.stringify(trace),
    timeline = new ReplayTimeline(trace, 'jis')
  expect(timeline.at(399)).toMatchObject({ typed: 'sin', misses: 0, count: 3 })
  expect(timeline.at(500)).toMatchObject({
    typed: 'sinn',
    misses: 1,
    mistake: true,
    position: 2,
  })
  expect(timeline.at(700)).toMatchObject({
    typed: 'sinnka',
    misses: 1,
    done: true,
    count: 7,
  })
  expect(timeline.at(200).typed).toBe('si')
  expect(JSON.stringify(trace)).toBe(before)
})
it('single-steps tied timestamps and transitions into idle and next prompts', () => {
  const r = new TypingTrace()
  r.begin(
    { text: 'あ', reading: 'あ', segments: [{ text: 'あ', reading: 'あ' }] },
    0,
    'jis',
  )
  r.add('a', 'a', 0, true, 100)
  r.begin(sentence, 100, 'jis')
  r.add('s', 's', 0, true, 100)
  r.add('i', 'i', 0, true, 100)
  const t = new ReplayTimeline(r.finish(500), 'jis')
  expect(t.at(100, 1)).toMatchObject({ prompt: 0, typed: 'a', count: 1 })
  expect(t.at(100, 2)).toMatchObject({ prompt: 1, typed: 's', count: 2 })
  expect(t.at(100)).toMatchObject({ prompt: 1, typed: 'si', count: 3 })
  expect(t.at(0, 0).count).toBe(0)
})
it('replays decomposed kana and legacy v1 logs with no display segments', () => {
  const s = {
      text: 'が',
      reading: 'が',
      segments: [{ text: 'が', reading: 'が' }],
    },
    r = new TypingTrace(),
    e = new KanaEngine(s.reading)
  r.begin(s, 0, 'kana')
  for (const [i, key] of [...e.target].entries()) {
    const pos = e.position
    r.add(key, key, pos, e.feed(key), (i + 1) * 100)
  }
  const trace = r.finish(300)
  delete trace.prompts[0].segments
  const t = new ReplayTimeline(trace, 'kana')
  expect(t.at(100)).toMatchObject({ position: 1, done: false, correct: 1 })
  expect(t.at(200)).toMatchObject({ position: 2, done: true, correct: 2 })
})
it('replays the exact fixed TypeWell endpoint in Roman and kana layouts', () => {
  for (const layout of ['jis', 'kana'] as const) {
    const doc = typewellDocument('typewell-space', 'replay', layout, 2),
      s = doc.sentences[0],
      e = typewellEngine(doc.plan),
      r = new TypingTrace()
    r.begin(s, 0, layout)
    let time = 0
    while (!e.done) {
      const pos = e.position,
        key = layout === 'kana' ? e.target[pos] : e.hint[0]
      r.add(key, key, pos, e.feed(key), (time += 10))
    }
    const limit = layout === 'kana' ? 280 : 400
    const t = new ReplayTimeline(r.finish(time), layout, limit)
    expect(t.at(time)).toMatchObject({ done: true, hint: '', correct: limit })
    expect(t.at(time - 1).done).toBe(false)
  }
})
it('rejects inconsistent accepted keys and positions instead of inventing playback', () => {
  const r = new TypingTrace()
  r.begin(sentence, 0, 'jis')
  r.add('z', 's', 0, true, 100)
  expect(() => new ReplayTimeline(r.finish(100), 'jis')).toThrow('入力判定')
})
