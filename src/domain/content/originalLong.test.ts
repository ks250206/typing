import { expect, it } from 'vitest'
import source from '../../../data/sources/original-long/typing_long_passages_21.json' with { type: 'json' }
import { originalLongEntries, originalLongPassages } from './originalLong'
import { sentencesByPassage } from './sentences'
import { KanaEngine, RomanEngine, type Layout } from '../typing/engine'
import { physicalKey, keyOutput } from '../typing/physicalKeyboard'
import { TypingTrace } from '../records/telemetry'
import { ReplayTimeline } from '../records/replay'

it('preserves all 21 supplied texts, metadata and exact reading alignments as one prompt each', () => {
  expect(originalLongEntries).toHaveLength(21)
  expect(new Set(originalLongEntries.map((p) => p.category)).size).toBe(7)
  for (const [i, original] of source.passages.entries()) {
    const passage = originalLongPassages[i]
    expect(passage.id).toBe(`original-long-${original.id}`)
    expect(originalLongEntries[i]).toMatchObject(original)
    expect(original.text.length).toBe(original.charCount)
    const sentences = sentencesByPassage[passage.id]
    expect(sentences).toHaveLength(1)
    expect(sentences[0].continuous).toBe(true)
    expect(sentences[0].text).toBe(original.text)
    expect(sentences[0].segments.map((s) => s.text).join('')).toBe(
      original.text,
    )
    expect(sentences[0].segments.map((s) => s.reading).join('')).toBe(
      sentences[0].reading,
    )
  }
})
for (const layout of [
  'jis',
  'us',
  'dvorak',
  'colemak',
  'workman',
  'kana',
] as Layout[]) {
  it(`completes all 21 intact passages through physical keys with ${layout}`, () => {
    for (const passage of originalLongPassages) {
      const sentence = sentencesByPassage[passage.id][0]
      const engine =
        layout === 'kana'
          ? new KanaEngine(sentence.reading)
          : new RomanEngine(sentence.reading)
      const input = layout === 'kana' ? engine.target : engine.hint
      for (const [i, char] of [...input].entries()) {
        const key = physicalKey(char, layout)
        if (!key || !engine.feed(keyOutput(key.code, key.shift, layout, char)!))
          throw Error(`${passage.id}/${layout}/${i}/${char}`)
        expect(engine.done).toBe(i === input.length - 1)
      }
      expect(engine.position).toBe(engine.target.length)
    }
  })
}
it('keeps the complete text and continuous display metadata in a replayable one-prompt trace', () => {
  const sentence = sentencesByPassage[originalLongPassages[0].id][0]
  const trace = new TypingTrace()
  const engine = new RomanEngine(sentence.reading)
  trace.begin(sentence, 0, 'jis')
  let time = 0
  for (const key of engine.hint) {
    const position = engine.position,
      expected = engine.hint[0]
    trace.add(key, expected, position, engine.feed(key), (time += 100))
  }
  const saved = trace.finish(time)
  expect(saved.prompts).toHaveLength(1)
  expect(saved.prompts[0].continuous).toBe(true)
  expect(saved.strokes.every((s) => s.prompt === 0)).toBe(true)
  const replay = new ReplayTimeline(saved, 'jis')
  expect(replay.sentences[0]).toEqual(sentence)
  expect(replay.countAt(time)).toBe(saved.strokes.length)
})
