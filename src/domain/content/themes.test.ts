import { expect, it } from 'vitest'
import data from '../../data/generated/themes.json' with { type: 'json' }
import { themePassages, themeTrainers } from './themes'
import { practiceDocument } from './practiceDocument'
import { typewellDocument, typewellEngine } from './typewell'
import { rtcPrompts } from './rtcWords'
import { createTrainerOrder, isTrainer } from './sakusaku'
import {
  RomanEngine,
  KanaEngine,
  layoutLabels,
  type Layout,
} from '../typing/engine'
import { physicalKey, keyOutput } from '../typing/physicalKeyboard'
it('registers five continuous essays, two originals and two complete trainer bags', () => {
  expect(themePassages.filter((p) => p.continuous)).toHaveLength(5)
  expect(themePassages.filter((p) => !p.continuous)).toHaveLength(2)
  for (const p of themePassages.filter((p) => p.continuous)) {
    const doc = practiceDocument(p.id, 'test', 'jis', 2)
    expect(doc.sentences).toHaveLength(1)
    expect(doc.sentences[0].text.length).toBeGreaterThan(650)
  }
  for (const p of themeTrainers) {
    expect(isTrainer(p.id)).toBe(true)
    expect(p.durationMs).toBe(60000)
    expect(p.paragraphs).toHaveLength(24)
    const draw = createTrainerOrder('theme', 24)
    const a = Array.from({ length: 24 }, draw),
      b = Array.from({ length: 24 }, draw)
    expect(new Set(a).size).toBe(24)
    expect(new Set(b).size).toBe(24)
    expect(a).not.toEqual(b)
  }
})
it.each(data.passages)(
  'all readings in $title are aligned and physically typable',
  (p) => {
    for (const q of p.paragraphs) {
      expect(q.segments.map((s) => s.text).join('')).toBe(q.text)
      expect(q.segments.map((s) => s.reading).join('')).toBe(q.reading)
      for (const layout of Object.keys(layoutLabels) as Layout[]) {
        const engine =
          layout === 'kana'
            ? new KanaEngine(q.reading)
            : new RomanEngine(q.reading)
        const input = layout === 'kana' ? engine.target : engine.hint
        for (const char of input) {
          const key = physicalKey(char, layout)
          if (
            !key ||
            !engine.feed(
              keyOutput(key.code, key.shift, layout, char, key.altGraph)!,
            )
          )
            throw Error(`${p.id}/${layout}/${char}`)
        }
        expect(engine.done).toBe(true)
      }
    }
  },
)
it('reproduces new word sets with fixed natural 400/280 endpoints', () => {
  for (const id of ['typewell-scientists', 'typewell-sf'])
    for (const layout of ['jis', 'kana'] as const) {
      const a = typewellDocument(id, 'fixed', layout)
      expect(a).toEqual(typewellDocument(id, 'fixed', layout))
      expect(a.plan.reference.length).toBe(layout === 'kana' ? 280 : 400)
      expect(a.plan.reference).not.toBe(
        typewellDocument(id, 'different', layout).plan.reference,
      )
      const e = typewellEngine(a.plan)
      for (const key of a.plan.reference) expect(e.feed(key)).toBe(true)
      expect(e.done).toBe(true)
    }
})
it('keeps the RTC prefix reproducible when extending 15 prompts to a full match', () => {
  const a = rtcPrompts('rtc-ai-ml-llm', 'fixed')
  expect(a).toHaveLength(15)
  expect(a).toEqual(rtcPrompts('rtc-ai-ml-llm', 'fixed', 133).slice(0, 15))
  expect(a).not.toEqual(rtcPrompts('rtc-ai-ml-llm', 'different'))
  for (const s of a)
    expect(
      data.rtcParts[0].some((x) =>
        data.rtcParts[1].some((y) => x.text + y.text === s.text),
      ),
    ).toBe(true)
})
