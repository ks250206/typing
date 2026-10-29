/// <reference types="node" />
import { expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import data from '../../data/generated/etyping.json' with { type: 'json' }
import { etypingDocument, etypingPassages } from './etyping'
import { mapKey } from '../typing/engine'
import { sentenceWordStarts } from '../typing/wordSpacing'

it('imports all supplied XML words and readings in order; only identical Valentine files merge', () => {
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
  })
  expect(data.flatMap((s) => s.sources)).toHaveLength(7)
  for (const set of data) {
    expect(set.title).not.toMatch(/[0-9]/)
    for (const source of set.sources) {
      const raw = readFileSync(
        new URL(`../../../data/sources/etyping/${source.file}`, import.meta.url),
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
