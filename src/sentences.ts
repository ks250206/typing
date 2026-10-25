import { normalizeReading } from './engine'
import { passages } from './passages'
import { kanjiReadings } from './passageReadings'

export interface ReadingSegment {
  text: string
  reading: string
}
export interface Sentence {
  text: string
  reading: string
  segments: ReadingSegment[]
}

/** Explicit kanji readings avoid estimating display progress from character ratios. */
export const sentencesByPassage: Record<string, Sentence[]> =
  Object.fromEntries(
    passages.map((passage) => {
      const sentences: Sentence[] = []
      passage.paragraphs.forEach((paragraph, index) => {
        const readings = kanjiReadings[passage.id][index].split('/')
        let kanjiIndex = 0
        let segments: ReadingSegment[] = []
        let reconstructed = ''
        const flush = () => {
          if (!segments.length) return
          sentences.push({
            text: segments.map((s) => s.text).join(''),
            reading: segments.map((s) => s.reading).join(''),
            segments,
          })
          segments = []
        }
        for (const text of paragraph.text.match(/[一-龯々]+|./gu) ?? []) {
          const reading = /^[一-龯々]/u.test(text)
            ? readings[kanjiIndex++]
            : normalizeReading(text)
          if (!reading)
            throw new Error(`Missing reading: ${passage.id}/${text}`)
          segments.push({ text, reading })
          reconstructed += reading
          if (text === '。') flush()
        }
        flush()
        if (
          reconstructed !== paragraph.reading ||
          kanjiIndex !== readings.length
        )
          throw new Error(`Reading alignment mismatch: ${passage.id}/${index}`)
      })
      return [passage.id, sentences]
    }),
  )

export function locateSegments(sentence: Sentence, decomposed: boolean) {
  let end = 0
  return sentence.segments.map((segment) => {
    const start = end
    end += segment.reading.normalize(decomposed ? 'NFD' : 'NFC').length
    return { ...segment, start, end }
  })
}
