import { describe, expect, it } from 'vitest'
import { passages } from './passages'
import { locateSegments, sentencesByPassage } from './sentences'
import { KanaEngine, RomanEngine } from './engine'

describe('main text and reading alignment', () => {
  for (const passage of passages) {
    it(`preserves all text and readings in ${passage.id}`, () => {
      const sentences = sentencesByPassage[passage.id]
      expect(sentences.map((s) => s.text).join('')).toBe(
        passage.paragraphs.map((p) => p.text).join(''),
      )
      expect(sentences.map((s) => s.reading).join('')).toBe(
        passage.paragraphs.map((p) => p.reading).join(''),
      )
      for (const sentence of sentences) {
        if (passage.splitSentences !== false)
          expect(sentence.text.match(/。/g) ?? []).toHaveLength(
            passage.durationMs || passage.genre === 'e-typing' ? 0 : 1,
          )
        for (const kana of [false, true]) {
          const engine = kana
            ? new KanaEngine(sentence.reading)
            : new RomanEngine(sentence.reading)
          const segments = locateSegments(sentence, kana)
          expect(segments.at(-1)?.end).toBe(engine.target.length)
          while (!engine.done) {
            // Exactly one display group contains every reachable reading position.
            expect(
              segments.filter(
                (s) => s.start <= engine.position && engine.position < s.end,
              ),
            ).toHaveLength(1)
            expect(engine.feed(engine.hint[0])).toBe(true)
          }
        }
      }
    })
  }
  it('keeps voiced kana highlighted until the dakuten is entered', () => {
    const sentence = sentencesByPassage['night-library'][0]
    const segments = locateSegments(sentence, true)
    const ga = segments.find((s) => s.text === 'が')!
    expect(ga.end - ga.start).toBe(2)
    expect(
      segments.find((s) => s.start <= ga.start + 1 && ga.start + 1 < s.end)
        ?.text,
    ).toBe('が')
  })
  it('maps kanji groups to reviewed readings, including ambiguous kana anchors', () => {
    const last = sentencesByPassage['rain-city'].flatMap((s) => s.segments)
    expect(last.filter((s) => s.text === '音楽').map((s) => s.reading)).toEqual(
      ['おんがく', 'おんがく'],
    )
    expect(last.find((s) => s.text === '似合')?.reading).toBe('にあ')
    expect(sentencesByPassage['night-library'][0].segments[0]).toEqual({
      text: '閉館',
      reading: 'へいかん',
    })
  })
})
