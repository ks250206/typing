import sportsSources from '../../../data/sources/themes/sports-provenance.json' with { type: 'json' }
import scientistSources from '../../../data/sources/themes/scientists-provenance.json' with { type: 'json' }
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
  for (const id of ['typewell-scientists', 'typewell-sf', 'typewell-sports'])
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

it('provides 100 unique aligned and typable phrases in each AI RTC half', () => {
  for (const part of data.rtcParts) {
    expect(part).toHaveLength(100)
    expect(new Set(part.map((p) => p.text)).size).toBe(100)
    for (const phrase of part) {
      expect(phrase.segments.map((s) => s.text).join('')).toBe(phrase.text)
      expect(phrase.segments.map((s) => s.reading).join('')).toBe(
        phrase.reading,
      )
      const engine = new RomanEngine(phrase.reading)
      for (const key of engine.hint) expect(engine.feed(key)).toBe(true)
      expect(engine.done).toBe(true)
    }
  }
  expect(
    new Set(
      data.rtcParts[0].flatMap((a) =>
        data.rtcParts[1].map((b) => a.text + b.text),
      ),
    ).size,
  ).toBe(10000)
})

it('contains 1000 distinct scientist names with sourced additions and typable readings', () => {
  const scientists = data.words.scientists
  expect(scientists).toHaveLength(1000)
  expect(new Set(scientists.map(([name]) => name)).size).toBe(1000)
  expect(scientistSources.additions).toHaveLength(890)
  expect(
    new Set(scientistSources.additions.map((p) => p.wikidataId)).size,
  ).toBe(890)
  expect(scientists.slice(110)).toEqual(
    scientistSources.additions.map((p) => [p.name, p.reading]),
  )
  for (const [name, reading] of scientists) {
    expect(reading, name).toMatch(/^[ぁ-ゖー・]+$/u)
    for (const engine of [new RomanEngine(reading), new KanaEngine(reading)]) {
      const keys = engine instanceof RomanEngine ? engine.hint : engine.target
      for (const key of keys)
        expect(engine.feed(key), `${name}: ${key}`).toBe(true)
      expect(engine.done, name).toBe(true)
    }
  }
})

it('contains 500 distinct sports teams with aligned provenance and typable readings', () => {
  expect(data.words.sports).toHaveLength(500)
  expect(new Set(data.words.sports.map(([name]) => name)).size).toBe(500)
  expect(new Set(sportsSources.teams.map((p) => p.wikidataId)).size).toBe(500)
  expect(data.words.sports).toEqual(
    sportsSources.teams.map((p) => [p.name, p.reading]),
  )
  for (const [name, reading] of data.words.sports) {
    for (const engine of [new RomanEngine(reading), new KanaEngine(reading)]) {
      const keys = engine instanceof RomanEngine ? engine.hint : engine.target
      for (const key of keys)
        expect(engine.feed(key), `${name}: ${key}`).toBe(true)
      expect(engine.done, name).toBe(true)
    }
  }
})
it('presents Silenus as a poem with one sentence per paragraph', () => {
  const poem = themePassages.find((p) => p.id === 'theme-silenus')!
  expect(poem.title).toBe('マーティン・サイリーナスの詩')
  expect(poem.paragraphs).toHaveLength(20)
  expect(practiceDocument(poem.id, 'test', 'jis', 2).sentences).toHaveLength(20)
  for (const paragraph of poem.paragraphs)
    expect(paragraph.text.match(/。/g)).toHaveLength(1)
})
