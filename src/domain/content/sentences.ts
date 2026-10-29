import { normalizeReading } from '../typing/engine'
import { passages } from './passages'
import { kanjiReadings } from './passageReadings'

export interface ReadingSegment {
  text: string
  reading: string
}
export interface Sentence {
  continuous?: boolean
  label?: string
  note?: string
  text: string
  reading: string
  segments: ReadingSegment[]
}

/** Explicit alignments also support historical written kana with modern readings. */
export const sentencesByPassage: Record<string, Sentence[]> =
  Object.fromEntries(
    passages.map((passage) => {
      const sentences: Sentence[] = []
      passage.paragraphs.forEach((paragraph, index) => {
        const aligned =
          paragraph.segments ??
          (() => {
            const readings = kanjiReadings[passage.id][index].split('/')
            let kanjiIndex = 0
            const parts = (paragraph.text.match(/[一-龯々]+|./gu) ?? []).map(
              (text) => {
                const reading = /^[一-龯々]/u.test(text)
                  ? readings[kanjiIndex++]
                  : normalizeReading(text)
                if (!reading)
                  throw new Error(`Missing reading: ${passage.id}/${text}`)
                return { text, reading }
              },
            )
            if (kanjiIndex !== readings.length)
              throw new Error(`Reading count mismatch: ${passage.id}/${index}`)
            return parts
          })()
        if (
          aligned.map((s) => s.text).join('') !== paragraph.text ||
          aligned.map((s) => s.reading).join('') !== paragraph.reading
        )
          throw new Error(`Reading alignment mismatch: ${passage.id}/${index}`)
        let segments: ReadingSegment[] = []
        const flush = () => {
          if (!segments.length) return
          sentences.push({
            ...(passage.continuous ? { continuous: true } : {}),
            ...(paragraph.label ? { label: paragraph.label } : {}),
            text: segments.map((s) => s.text).join(''),
            reading: segments.map((s) => s.reading).join(''),
            segments,
          })
          segments = []
        }
        for (const segment of aligned) {
          segments.push(segment)
          if (segment.text === '。' && passage.splitSentences !== false) flush()
        }
        flush()
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
