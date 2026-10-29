import type { practiceDocument } from './practiceDocument'
import { createTrainerOrder, isTrainer } from './sakusaku'
import { isTypewell } from './typewell'

export function practicePreview(
  practice: ReturnType<typeof practiceDocument>,
  seed: string,
  replayVersion: 1 | 2,
) {
  const { passage, sentences } = practice
  const trainer = isTrainer(passage.id)
  const typewell = isTypewell(passage.id)
  const previewParagraphs = (() => {
    if (!trainer || replayVersion === 1) return passage.paragraphs
    const next = createTrainerOrder(seed, sentences.length, replayVersion)
    return Array.from(
      { length: sentences.length },
      () => passage.paragraphs[next()],
    )
  })()
  const paragraphSegments = (() => {
    if (trainer) return previewParagraphs.map((p) => p.segments!)
    let cursor = 0
    if (typewell) return [sentences[0].segments]
    return passage.paragraphs.map((paragraph) => {
      const segments = []
      let length = 0
      while (length < paragraph.text.length) {
        const sentence = sentences[cursor++]
        segments.push(...sentence.segments)
        length += sentence.text.length
      }
      return segments
    })
  })()
  return { previewParagraphs, paragraphSegments }
}
