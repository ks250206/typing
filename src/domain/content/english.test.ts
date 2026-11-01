import { expect, it } from 'vitest'
import data from '../../data/generated/english.json' with { type: 'json' }
import {
  englishDocument,
  englishPassages,
  englishSentence,
  isEnglishTypewell,
} from './english'
import { practiceDocument, practicePassages } from './practiceDocument'
import { sentencePracticePool } from './sentencePracticePool'
import { EnglishEngine } from '../typing/sentenceEngine'
import { mapKey, type Layout } from '../typing/engine'
import { physicalKey, keyOutput } from '../typing/physicalKeyboard'
import { TypingTrace } from '../records/telemetry'
import { ReplayTimeline } from '../records/replay'
import { extractWeakWords, weakDocument } from '../records/weakWords'
import { sentenceEngine, sentenceKeyCount } from '../typing/sentenceEngine'

it('imports the 19 latest distinct e-typing titles and four complete English dictionaries', () => {
  expect(data.filter((s) => s.kind === 'etyping')).toHaveLength(19)
  expect(data.filter((s) => s.kind === 'typewell')).toHaveLength(4)
  expect(data.reduce((n, s) => n + s.entries.length, 0)).toBe(7540)
  expect(new Set(data.map((s) => `${s.kind}/${s.title}`)).size).toBe(23)
  const rounds = data
    .filter((s) => s.kind === 'etyping')
    .flatMap((s) => [s.source, ...s.aliases].map((a) => a.round))
  expect(rounds.sort((a, b) => a! - b!)).toEqual(
    Array.from({ length: 38 }, (_, i) => i + 1),
  )
  for (const set of data) {
    expect(new Set(set.entries).size).toBe(set.entries.length)
    expect(set.entries.every((word) => /^[ -~]+$/.test(word))).toBe(true)
    if (set.kind === 'etyping')
      expect(set.source.round).toBe(
        Math.max(...[set.source, ...set.aliases].map((a) => a.round!)),
      )
  }
})

it.each(englishPassages)(
  '$id is typeable literally and replayable from the same seed',
  (passage) => {
    const doc = practiceDocument(passage.id, 'english-test', 'jis', 2)
    expect(doc).toEqual(englishDocument(passage.id, 'english-test'))
    expect(doc.passage.language).toBe('en')
    for (const sentence of doc.sentences) {
      const engine = new EnglishEngine(sentence.reading)
      expect(sentence.text).toBe(sentence.reading)
      expect(sentence.segments.map((s) => s.text).join('')).toBe(sentence.text)
      for (const character of sentence.text)
        expect(engine.feed(character)).toBe(true)
      expect(engine.done).toBe(true)
      expect(engine.naturalRemaining).toBe(0)
    }
    if (isEnglishTypewell(passage.id)) {
      expect(doc.sentences[0].reading).toHaveLength(400)
      expect(doc.sentences[0].text).toContain(' ')
    } else if (passage.id.startsWith('en-etyping-')) {
      expect(doc.sentences).toHaveLength(15)
      expect(new Set(doc.sentences.map((s) => s.text)).size).toBe(15)
      expect(doc).not.toEqual(englishDocument(passage.id, 'another'))
    }
  },
)

it('covers originals and intact long text, and splits long text only for one-sentence practice', () => {
  expect(englishPassages.filter((p) => p.genre === 'オリジナル')).toHaveLength(
    4,
  )
  const long = englishPassages.filter((p) => p.genre === 'オリジナル長文')
  expect(long).toHaveLength(2)
  for (const p of long) {
    expect(englishDocument(p.id, 'test').sentences).toHaveLength(1)
    expect(p.paragraphs[0].text.length).toBeGreaterThan(2000)
    const pool = sentencePracticePool(p.id, 'jis')
    expect(pool.length).toBeGreaterThan(10)
    expect(pool.map((s) => s.text).join(' ')).toBe(p.paragraphs[0].text)
  }
  expect(sentencePracticePool('en-typewell-01', 'jis')).toHaveLength(1500)
  const japanese = sentencePracticePool('night-library', 'jis')
  expect(japanese.length).toBeGreaterThan(3)
  expect(
    japanese.every(
      (s) => s.segments.map((p) => p.reading).join('') === s.reading,
    ),
  ).toBe(true)
})

it.each(practicePassages)(
  '$id supplies aligned prompts for sentence practice',
  (passage) => {
    const pool = sentencePracticePool(passage.id, 'jis')
    expect(pool.length).toBeGreaterThan(0)
    for (const sentence of pool) {
      expect(sentence.text.length).toBeGreaterThan(0)
      expect(sentence.reading.length).toBeGreaterThan(0)
      expect(sentence.segments.map((s) => s.text).join('')).toBe(sentence.text)
      expect(sentence.segments.map((s) => s.reading).join('')).toBe(
        sentence.reading,
      )
      if (passage.language === 'en') expect(sentence.language).toBe('en')
    }
  },
)

it('requires Shift for capitals, respects Caps Lock and preserves the Japanese case-insensitive behavior', () => {
  expect(sentenceKeyCount({ reading: 'がぱ' }, 'kana')).toBe(4)
  expect(sentenceKeyCount(englishSentence('A B.'), 'jis')).toBe(4)
  const engine = new EnglishEngine('Hello! A B.')
  expect(engine.feed('h')).toBe(false)
  expect(engine.feed('H')).toBe(true)
  const event = { key: 'H', code: 'KeyH', shiftKey: true }
  expect(mapKey(event, 'jis', 'H', true)).toBe('H')
  expect(mapKey(event, 'jis')).toBe('h')
  expect(
    mapKey(
      {
        key: 'a',
        code: 'KeyA',
        shiftKey: false,
        getModifierState: (name) => name === 'CapsLock',
      },
      'us',
      'A',
      true,
    ),
  ).toBe('A')
  const characters = new Set(
    englishPassages.flatMap((p) => p.paragraphs.flatMap((s) => [...s.text])),
  )
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
  ] as Layout[]) {
    for (const character of characters) {
      const physical = physicalKey(character, layout)
      expect(physical, `${layout}/${character}`).toBeDefined()
      expect(
        keyOutput(
          physical!.code,
          physical!.shift,
          layout,
          character,
          physical!.altGraph,
          true,
        ),
      ).toBe(character)
    }
  }
})

it('keeps English language and exact case in recorded traces, playback and 400-key replays', () => {
  for (const text of [
    'Hi, I am here!',
    englishDocument('en-typewell-01', 'replay').sentences[0].text,
  ]) {
    const sentence = englishSentence(text)
    const trace = new TypingTrace()
    const engine = new EnglishEngine(text)
    trace.begin(sentence, 0, 'us')
    let time = 10
    for (const key of text) {
      const position = engine.position
      const expected = engine.hint[0]
      trace.add(key, expected, position, engine.feed(key), (time += 10))
    }
    const recorded = trace.finish(time)
    const timeline = new ReplayTimeline(
      recorded,
      'us',
      text.length === 400 ? 400 : undefined,
    )
    expect(timeline.at(time).sentence.language).toBe('en')
    expect(timeline.at(time).typed).toBe(text)
    expect(timeline.at(time).done).toBe(true)
  }
})

it('preserves literal English when weak words are extracted and repeated', () => {
  const sentence = englishSentence('Hello world.')
  const trace = new TypingTrace()
  trace.begin(sentence, 0, 'jis')
  trace.add('h', 'H', 0, false, 50)
  const engine = sentenceEngine(sentence, 'jis')
  let time = 50
  for (const key of sentence.text) {
    const position = engine.position
    const expected = engine.hint[0]
    trace.add(key, expected, position, engine.feed(key), (time += 50))
  }
  const words = extractWeakWords([
    {
      id: 'english',
      passageId: 'en-library',
      title: 'English',
      layout: 'jis',
      date: '2026-11-01',
      elapsed: time,
      keys: sentence.text.length,
      misses: 1,
      kpm: 100,
      accuracy: 90,
      trace: trace.finish(time),
    },
  ])
  const hello = words.find((w) => w.text === 'Hello')!
  expect(hello.language).toBe('en')
  const doc = weakDocument([hello], 5)
  expect(doc.sentences).toHaveLength(5)
  const repeated = sentenceEngine(doc.sentences[0], 'jis')
  expect(repeated.hint).toBe('Hello')
  expect(repeated.feed('h')).toBe(false)
  expect(repeated.feed('H')).toBe(true)
})
