/// <reference types="node" />
import { expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import data from '../../data/generated/etyping.json' with { type: 'json' }
import { etypingDocument, etypingPassages } from './etyping'
import { KanaEngine, RomanEngine, mapKey } from '../typing/engine'
import { sentenceWordStarts } from '../typing/wordSpacing'

it('imports 26 unique titles from 52 weeks, preserving XML words and readings in order', () => {
  expect(
    Object.fromEntries(
      etypingPassages.map((p) => [p.title, p.paragraphs.length]),
    ),
  ).toEqual({
    元気が出る言葉: 507,
    顔の慣用句: 184,
    '擬音・擬態語': 226,
    思い出の言葉: 380,
    春の言葉: 113,
    バレンタイン: 167,
    秋の言葉: 284,
    体の慣用句: 161,
    初夏の言葉: 360,
    エコライフ: 147,
    大好きなおやつ: 331,
    魚のことわざ: 172,
    おふくろの味: 119,
    慣用句: 310,
    いろはかるた: 47,
    数のある言葉: 216,
    ことわざ: 211,
    梅雨の言葉: 215,
    給食のおかず: 213,
    学校にあるもの: 201,
    短いことわざ: 113,
    夏のおやつ: 82,
    夏の言葉: 380,
    食感ことば: 119,
    冬の言葉: 233,
    大掃除の言葉: 196,
  })
  expect(data.flatMap((s) => s.sources)).toHaveLength(27)
  for (const set of data) {
    expect(set.title).not.toMatch(/[0-9]/)
    for (const source of set.sources) {
      const raw = readFileSync(
        new URL(
          `../../../data/sources/etyping/${source.file}`,
          import.meta.url,
        ),
      )
      expect(createHash('sha256').update(raw).digest('hex')).toBe(source.sha256)
      // These snapshots have no XML entities in the word data.
      const pairs = [
        ...raw
          .toString('utf8')
          .matchAll(
            /<Word>\s*<Display>([^<]*)<\/Display>\s*<Characters>([^<]*)<\/Characters>\s*<\/Word>/g,
          ),
      ].map((m) => [m[1], m[2]])
      expect(pairs).toHaveLength(source.count)
      expect(pairs).toEqual(set.entries.map((row) => [row[0], row[1]]))
    }
  }
})
it('selects 15 distinct questions deterministically, changes with seed and never mutates the corpus', () => {
  expect(
    etypingDocument('etyping-spring', 'xml-replay-test').sentences.map(
      (s) => s.text,
    ),
  ).toMatchInlineSnapshot(`
    [
      "温かい風が気持ちいい",
      "パパどこかつれてって",
      "春の海ひねもすのたりのたりかな",
      "空気がほわほわ",
      "ちまきをむくのはへたです",
      "草餅も好きだけど、桜餅も好き",
      "連休は家で寝る",
      "ピクニックに行こう",
      "タンポポの綿毛を風に乗せ",
      "さわやかな水仙の香り",
      "柏餅はこしあんよりみそあん",
      "きれいな黄色のチューリップ",
      "連休もバイト",
      "風が春の訪れを感じさせる",
      "日差しの中を歩くんだ",
    ]
  `)
  for (const passage of etypingPassages) {
    const before = JSON.stringify(passage)
    const a = etypingDocument(passage.id, 'replay-test')
    expect(a).toEqual(etypingDocument(passage.id, 'replay-test'))
    expect(a.sentences).toHaveLength(15)
    expect(new Set(a.sentences.map((s) => s.text)).size).toBe(15)
    expect(a.sentences).not.toEqual(
      etypingDocument(passage.id, 'other-seed').sentences,
    )
    for (const sentence of a.sentences)
      expect(passage.paragraphs).toContainEqual(sentence)
    expect(JSON.stringify(passage)).toBe(before)
  }
})
it('keeps reviewed kanji readings, fullwidth display digits and literal slash readings', () => {
  const all = etypingPassages.flatMap((p) => p.paragraphs)
  expect(
    all.find((p) => p.text === '自分でやらずに他人に頼るな')?.segments,
  ).toContainEqual({ text: '他人', reading: 'たにん' })
  expect(
    all.find((p) => p.text === '思わず目頭が熱くなった')?.segments,
  ).toContainEqual({ text: '目頭', reading: 'めがしら' })
  expect(all.find((p) => p.text === '１個あまったからあげる')?.reading).toBe(
    '1こあまったからあげる',
  )
  expect(all.find((p) => p.text === 'トライ・アンド・エラー')?.reading).toBe(
    'とらい/あんど/えらー',
  )
})
it('accepts literal digits/slash only in their kana target positions, preserving kana keys elsewhere', () => {
  const digit = { code: 'Digit1', key: '1', shiftKey: false }
  expect(mapKey(digit, 'kana', '1')).toBe('1')
  expect(mapKey(digit, 'kana', 'ぬ')).toBe('ぬ')
  const slash = { code: 'Slash', key: '/', shiftKey: false }
  expect(mapKey(slash, 'kana', '/')).toBe('/')
  expect(mapKey(slash, 'kana', 'め')).toBe('め')
})
it('does not split contracted kana when a tokenizer places a word boundary inside きゃ', () => {
  const sentence = etypingPassages
    .flatMap((p) => p.paragraphs)
    .find((p) => p.text === '君がやらなきゃ誰がやる')!
  expect(
    sentenceWordStarts({
      ...sentence,
      segments: sentence.segments!,
    }).reading.has(7),
  ).toBe(false)
})

it.each(etypingPassages)(
  '$id: every boundary maps to exact text and reading offsets, and both engines finish',
  (passage) => {
    for (const paragraph of passage.paragraphs) {
      expect(paragraph.segments!.map((s) => s.text).join('')).toBe(
        paragraph.text,
      )
      expect(paragraph.segments!.map((s) => s.reading).join('')).toBe(
        paragraph.reading,
      )
      const offsets = new Set<number>()
      let position = 0
      for (const segment of paragraph.segments!) {
        offsets.add(position)
        position += segment.text.length
      }
      const starts = paragraph.wordStarts!
      expect(starts).toEqual([...new Set(starts)].sort((a, b) => a - b))
      for (const start of starts) {
        expect(start).toBeGreaterThan(0)
        expect(start).toBeLessThan(paragraph.text.length)
        expect(offsets.has(start)).toBe(true)
        expect(paragraph.text[start]).not.toMatch(
          /[ぁぃぅぇぉゃゅょゎっァィゥェォャュョヮッー々]/u,
        )
      }
      const boundaries = sentenceWordStarts({
        ...paragraph,
        segments: paragraph.segments!,
      })
      expect(boundaries.segments.size).toBe(starts.length)
      for (const Engine of [RomanEngine, KanaEngine]) {
        const engine = new Engine(paragraph.reading)
        const keys = engine instanceof RomanEngine ? engine.hint : engine.target
        for (const key of keys) {
          if (!engine.feed(key))
            throw new Error(`Unreachable reading: ${paragraph.text} / ${key}`)
        }
        expect(engine.done).toBe(true)
      }
    }
  },
)

it.each([
  'みたらしだんご',
  'ぴよりん',
  'ねるねるねるね',
  'ぷるぷる',
  'さっくり',
  'ふわっふわ',
  'さつまりこ',
  'たこせん',
  'なげわ',
  'まけんグミ',
  'わらびーもち',
])(
  'keeps reviewed kana word %s whole even where browser tokenizers fragment it',
  (word) => {
    const examples = etypingPassages
      .flatMap((p) => p.paragraphs)
      .filter((p) => p.text.includes(word))
    expect(examples.length).toBeGreaterThan(0)
    for (const paragraph of examples) {
      const start = paragraph.text.indexOf(word)
      expect(
        paragraph.wordStarts!.some(
          (offset) => start < offset && offset < start + word.length,
        ),
      ).toBe(false)
    }
  },
)

it.each([
  ['三拍子揃った選手', '三拍子', 'さんびょうし'],
  ['三拍子揃った選手', '揃', 'そろ'],
  ['予想は百発百中だ', '百発百中', 'ひゃっぱつひゃくちゅう'],
  ['部屋中洗濯物だらけ', '中', 'じゅう'],
  ['部屋中洗濯物だらけ', '洗濯物', 'せんたくもの'],
])('%s retains the reviewed %s → %s reading', (text, surface, reading) => {
  const paragraph = etypingPassages
    .flatMap((p) => p.paragraphs)
    .find((p) => p.text === text)!
  expect(paragraph.segments).toContainEqual({ text: surface, reading })
})
