import { englishPassages, englishSentence, isEnglish } from './english'
import { practiceDocument } from './practiceDocument'
import type { Sentence } from './sentences'
import { isTypewell, typewellPromptPool } from './typewell'
import type { Layout } from '../typing/engine'

/** Full dictionaries for word sets; authored long text is split at sentence boundaries. */
export function sentencePracticePool(id: string, layout: Layout): Sentence[] {
  if (isEnglish(id)) {
    const passage = englishPassages.find((p) => p.id === id)!
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })
    return passage.paragraphs.flatMap((p) =>
      passage.continuous
        ? [...segmenter.segment(p.text)].map((part) =>
            englishSentence(part.segment.trim()),
          )
        : [englishSentence(p.text)],
    )
  }
  if (isTypewell(id)) return typewellPromptPool(id)
  const document = practiceDocument(id, 'sentence-practice-v1', layout, 2)
  const sentences: Sentence[] = document.sentences
  return sentences.flatMap((sentence) => {
    if (!sentence.continuous) return [sentence]
    const parts: Sentence[] = []
    let segments: Sentence['segments'] = []
    let offset = 0
    const flush = () => {
      if (!segments.length) return
      parts.push({
        text: segments.map((s) => s.text).join(''),
        reading: segments.map((s) => s.reading).join(''),
        segments,
        ...(sentence.wordStarts
          ? {
              wordStarts: sentence.wordStarts
                .filter(
                  (start) =>
                    start > offset &&
                    start <
                      offset + segments.reduce((n, s) => n + s.text.length, 0),
                )
                .map((start) => start - offset),
            }
          : {}),
      })
      offset += segments.reduce((n, s) => n + s.text.length, 0)
      segments = []
    }
    for (const segment of sentence.segments) {
      segments.push(segment)
      if (/[。！？]$/.test(segment.text)) flush()
    }
    flush()
    return parts
  })
}
