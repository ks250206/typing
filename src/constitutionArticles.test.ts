import { expect, it } from 'vitest'
import official from '../data/sources/constitution/articles.json' with { type: 'json' }
import {
  constitutionArticles,
  constitutionArticleDocument,
  constitutionArticlePassage,
} from './constitutionArticles'
import { sentencesByPassage } from './sentences'
import { TypingTrace } from './telemetry'
import { ReplayTimeline } from './replay'

const numbers = [9, 11, 13, 14, 19, 20, 21, 25, 26, 27, 28, 30, 41, 96]
it('includes exactly the requested 14 articles with every official paragraph, including all of articles 9 and 96', () => {
  expect(constitutionArticles.map((a) => a.number)).toEqual(numbers)
  expect(constitutionArticles.map((a) => a.text)).toEqual(
    official.articles.map((a) => a.paragraphs.join('')),
  )
  expect(sentencesByPassage[constitutionArticlePassage.id]).toHaveLength(14)
  for (const article of constitutionArticles) {
    expect(article.segments.map((s) => s.text).join('')).toBe(article.text)
    expect(article.segments.map((s) => s.reading).join('')).toBe(
      article.reading,
    )
  }
  expect(constitutionArticles.find((a) => a.number === 9)!.text).toContain(
    '国の交戦権は、これを認めない。',
  )
  expect(constitutionArticles.find((a) => a.number === 96)!.text).toMatch(
    /直ちにこれを公布する。$/u,
  )
})
it('shuffles articles without replacement, preserves all within-article text and reproduces the seed', () => {
  const before = JSON.stringify(constitutionArticles)
  const order = (seed: string) =>
    constitutionArticleDocument(seed).sentences.map((s) => s.number)
  expect(order('same')).toEqual(order('same'))
  expect(order('same')).not.toEqual(order('different'))
  for (let seed = 0; seed < 30; seed++) {
    const doc = constitutionArticleDocument(String(seed))
    expect(doc.sentences.map((s) => s.number).sort((a, b) => a - b)).toEqual(
      numbers,
    )
    expect(doc.passage.paragraphs.map((p) => p.text)).toEqual(
      doc.sentences.map((s) => s.text),
    )
    for (const s of doc.sentences)
      expect(s).toEqual(constitutionArticles.find((a) => a.number === s.number))
  }
  expect(JSON.stringify(constitutionArticles)).toBe(before)
})
it('keeps historical legal spelling with modern readings and legal terms with reviewed readings', () => {
  const segments = constitutionArticles.flatMap((a) => a.segments)
  for (const pair of [
    ['負ふ', 'おう'],
    ['与へ', 'あたえ'],
    ['伴は', 'ともなわ'],
    ['あつ', 'あっ'],
    ['行は', 'おこなわ'],
    ['下', 'もと'],
    ['何人', 'なんぴと'],
  ])
    expect(segments).toContainEqual({ text: pair[0], reading: pair[1] })
})
it('retains article identity in saved logs and replay, with backwards-compatible optional labels', () => {
  const sentence = constitutionArticles.find((a) => a.number === 30)!
  const log = new TypingTrace()
  log.begin(sentence, 0, 'jis')
  const trace = log.finish(500)
  expect(trace.prompts[0].label).toBe('第30条 · 納税の義務')
  expect(new ReplayTimeline(trace, 'jis').at(0).sentence.label).toBe(
    sentence.label,
  )
  delete trace.prompts[0].label
  expect(new ReplayTimeline(trace, 'jis').at(0).sentence.label).toBeUndefined()
})
