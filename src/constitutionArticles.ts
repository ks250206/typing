import data from './data/generated/constitutionArticles.json' with { type: 'json' }
import type { Passage } from './passages'
import { seededRandom } from './typewell'
export const constitutionArticles = data.articles
export const constitutionArticlePassage: Passage = {
  id: 'constitution-articles',
  title: '日本国憲法 条文集',
  genre: '公的文書',
  accent: '法',
  subtitle:
    '指定14条の全項を、条単位のランダム順で最後まで。シード再現に対応。',
  splitSentences: false,
  source: { label: '衆議院：日本国憲法', url: data.source, kind: 'public' },
  paragraphs: constitutionArticles,
}
export const isConstitutionArticles = (id: string) =>
  id === constitutionArticlePassage.id
/** Shuffle complete articles without replacement; all paragraphs stay inside their article. */
export function constitutionArticleDocument(seed: string) {
  const articles = [...constitutionArticles]
  const random = seededRandom(`constitution-articles-v1/${seed}`)
  for (let i = articles.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[articles[i], articles[j]] = [articles[j], articles[i]]
  }
  return {
    passage: { ...constitutionArticlePassage, paragraphs: articles },
    sentences: articles,
    plan: null,
  }
}
