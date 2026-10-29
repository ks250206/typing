import type { Passage } from './passages'
import data from './data/generated/constitutionPreamble.json' with { type: 'json' }
export const constitutionSource = data.source
export const constitution: Passage = {
  id: 'constitution-preamble',
  title: '日本国憲法 前文',
  genre: '公的文書',
  accent: '07',
  subtitle: '衆議院掲載の前文4段落を全文収録。本文は原文、入力は現代の読み。',
  source: constitutionSource,
  paragraphs: data.paragraphs,
}
