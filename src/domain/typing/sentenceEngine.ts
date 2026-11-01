import type { Sentence } from '../content/sentences'
import { KanaEngine, RomanEngine, type Layout } from './engine'

/** English is literal: case, punctuation and spaces are part of the exercise. */
export class EnglishEngine extends RomanEngine {
  override edges(position: number) {
    const text = this.target[position]
    return text ? [{ end: position + 1, text }] : []
  }
  override get hint() {
    return this.target.slice(this.position)
  }
  override get naturalHint() {
    return this.hint
  }
  override get naturalRemaining() {
    return this.target.length - this.position
  }
  override get naturalProgress() {
    return this.position
  }
}

export function sentenceEngine(
  sentence: Pick<Sentence, 'reading' | 'language'>,
  layout: Layout,
) {
  return sentence.language === 'en'
    ? new EnglishEngine(sentence.reading)
    : layout === 'kana'
      ? new KanaEngine(sentence.reading)
      : new RomanEngine(sentence.reading)
}
