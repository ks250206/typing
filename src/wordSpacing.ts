import { RomanEngine } from './engine'
import type { Sentence } from './sentences'

const japaneseWords = new Intl.Segmenter('ja', { granularity: 'word' })

/** Map word boundaries through the reviewed text/reading alignment, never ratios. */
export function sentenceWordStarts(sentence: Sentence) {
  const text = new Set(
    [...japaneseWords.segment(sentence.text)]
      .filter((part) => part.isWordLike && part.index > 0)
      .map((part) => part.index),
  )
  const reading = new Set<number>()
  const segments = new Set<number>()
  let textOffset = 0
  let readingOffset = 0
  sentence.segments.forEach((segment, index) => {
    // An internal boundary in a kanji group has no unambiguous reading offset.
    if (text.has(textOffset)) {
      segments.add(index)
      reading.add(readingOffset)
    }
    textOffset += segment.text.length
    readingOffset += segment.reading.length
  })
  return { segments, reading }
}

/** Follow a complete valid spelling so nn/n, shi/si and small-kana alternatives align. */
export function romanWordStarts(
  target: string,
  roman: string,
  readingStarts: Set<number>,
) {
  const engine = new RomanEngine(target)
  const failed = new Set<string>()
  const find = (position: number, offset: number): number[] | undefined => {
    if (position === target.length)
      return offset === roman.length ? [] : undefined
    const key = `${position}/${offset}`
    if (failed.has(key)) return
    for (const edge of engine.edges(position)) {
      if (!roman.startsWith(edge.text, offset)) continue
      const rest = find(edge.end, offset + edge.text.length)
      if (rest) return readingStarts.has(position) ? [offset, ...rest] : rest
    }
    failed.add(key)
  }
  return new Set(find(0, 0) ?? [])
}
