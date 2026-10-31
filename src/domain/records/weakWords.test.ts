import { expect, it } from 'vitest'
import { TypingTrace } from './telemetry'
import { extractWeakWords, weakDocument } from './weakWords'
import type { RecordEntry } from './types'

const sentence = {
  text: '銀河の記録',
  reading: 'ぎんがのきろく',
  segments: [
    { text: '銀河', reading: 'ぎんが' },
    { text: 'の', reading: 'の' },
    { text: '記録', reading: 'きろく' },
  ],
}
function record(layout: 'jis' | 'kana' = 'jis'): RecordEntry {
  const trace = new TypingTrace()
  trace.begin(sentence, 0, layout)
  trace.add('x', 'g', 0, false, 100)
  trace.add('g', 'g', 0, true, 200)
  trace.add('x', 'n', layout === 'kana' ? 5 : 3, false, 300) // the particle must not become a candidate
  trace.add('k', 'k', layout === 'kana' ? 6 : 4, true, 1300)
  trace.add('i', 'i', layout === 'kana' ? 6 : 4, true, 1400)
  return {
    id: layout,
    passageId: 'test',
    title: 'test',
    date: '2026-10-31T00:00:00Z',
    layout,
    keys: 3,
    misses: 2,
    elapsed: 1500,
    kpm: 120,
    accuracy: 60,
    trace: trace.finish(1500),
  }
}
it.each(['jis', 'kana'] as const)(
  'extracts observed misses and stalls with reviewed readings and skips one-character particles in %s',
  (layout) => {
    const words = extractWeakWords([record(layout)])
    expect(words.map((w) => w.text)).toEqual(['銀河', '記録'])
    expect(words[0]).toMatchObject({
      reading: 'ぎんが',
      misses: 1,
      attempts: 1,
    })
    expect(words[1].loss).toBe(900)
    expect(
      words.every(
        (w) => w.segments.map((s) => s.reading).join('') === w.reading,
      ),
    ).toBe(true)
  },
)
it('does not infer ruby from old or corrupt logs; aggregates the same word and keeps plans deterministic and bounded', () => {
  const old = record()
  old.trace!.prompts[0].segments = undefined
  expect(extractWeakWords([old, { ...old, trace: undefined }])).toEqual([])
  const words = extractWeakWords([record(), { ...record(), id: 'another' }])
  expect(words[0].misses).toBe(2)
  const plan = weakDocument(words, 3)
  expect(plan.sentences).toHaveLength(6)
  expect(plan.sentences.map((s) => s.text)).toEqual([
    '銀河',
    '記録',
    '銀河',
    '記録',
    '銀河',
    '記録',
  ])
  expect(weakDocument(words, 3)).toEqual(plan)
  expect(weakDocument(words, 4).passage.id).not.toBe(plan.passage.id)
  expect(() => weakDocument([], 3)).toThrow()
  expect(() => weakDocument(words, 21)).toThrow()
})
it('excludes common multi-character particles as well as single-character words', () => {
  const parts = [
    { text: '銀河', reading: 'ぎんが' },
    { text: 'か', reading: 'か' },
    { text: 'ら', reading: 'ら' },
    { text: '記録', reading: 'きろく' },
    { text: 'ま', reading: 'ま' },
    { text: 'で', reading: 'で' },
  ]
  const trace = new TypingTrace()
  trace.begin(
    {
      text: parts.map((s) => s.text).join(''),
      reading: parts.map((s) => s.reading).join(''),
      segments: parts,
    },
    0,
    'jis',
  )
  for (const [i, position] of [0, 3, 5, 8].entries())
    trace.add('x', 'a', position, false, (i + 1) * 100)
  expect(
    new Set(
      extractWeakWords([{ ...record(), trace: trace.finish(1000) }]).map(
        (w) => w.text,
      ),
    ),
  ).toEqual(new Set(['銀河', '記録']))
})

it('caps candidates at 100, ignores repetition runs and gives new weak encounters a new deletion token', () => {
  const old = record()
  const original = extractWeakWords([old])[0]
  const practice = { ...record(), id: 'repeat', mode: 'weak' as const }
  expect(extractWeakWords([old, practice])[0].misses).toBe(1)
  const fresh = { ...record(), id: 'new', date: '2026-11-01T00:00:00Z' }
  expect(extractWeakWords([old, fresh])[0].source).not.toBe(original.source)
  const records = Array.from({ length: 125 }, (_, i) => {
    const r = record()
    r.id = `source-${i}`
    const prompt = r.trace!.prompts[0]
    prompt.segments![0].text = `銀河${i}`
    prompt.text = prompt.segments!.map((s) => s.text).join('')
    return r
  })
  expect(extractWeakWords(records)).toHaveLength(100)
})
