import { RomanEngine } from './engine'
import type { Sentence } from '../content/sentences'

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
    // A contracted kana pair such as きゃ must stay in one typing group.
    if (
      text.has(textOffset) &&
      !/^[ゃゅょぁぃぅぇぉゎ]/u.test(segment.reading)
    ) {
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
  partial = false,
) {
  const engine = new RomanEngine(target)
  const failed = new Set<string>()
  const find = (position: number, offset: number): number[] | undefined => {
    if (position === target.length)
      return offset === roman.length ? [] : undefined
    if (partial && offset === roman.length) return []
    const key = `${position}/${offset}`
    if (failed.has(key)) return
    for (const edge of engine.edges(position)) {
      if (
        partial &&
        edge.text.startsWith(roman.slice(offset)) &&
        offset + edge.text.length > roman.length
      )
        return readingStarts.has(position) ? [offset] : []
      if (!roman.startsWith(edge.text, offset)) continue
      const rest = find(edge.end, offset + edge.text.length)
      if (rest) return readingStarts.has(position) ? [offset, ...rest] : rest
    }
    failed.add(key)
  }
  return new Set(find(0, 0) ?? [])
}

export function wordTone(offset: number, boundaries: Set<number>) {
  return [...boundaries].filter((start) => start <= offset).length % 6
}
/** Consume only completed words, never half a kanji reading or dakuten. */
export function consumedOffsets(
  target: string,
  position: number,
  typed: string,
  hint: string,
  boundaries: Set<number>,
  done: boolean,
  partialRoman = false,
) {
  const composed = target.normalize('NFC')
  const decomposed = target !== composed
  const reading = done
    ? composed.length
    : Math.max(
        0,
        ...[...boundaries].filter(
          (offset) =>
            composed.slice(0, offset).normalize(decomposed ? 'NFD' : 'NFC')
              .length <= position,
        ),
      )
  const input = composed
    .slice(0, reading)
    .normalize(decomposed ? 'NFD' : 'NFC').length
  const romanStarts = [
    ...romanWordStarts(composed, typed + hint, boundaries, partialRoman),
  ]
  const boundaryIndex = [...boundaries].indexOf(reading)
  const roman = done
    ? typed.length
    : boundaryIndex < 0
      ? 0
      : (romanStarts[boundaryIndex] ?? 0)
  return { reading, input, roman }
}
