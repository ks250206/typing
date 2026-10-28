import { RomanEngine } from './engine'

export function opponentRoman(reading: string, keys: number, kana: boolean) {
  const roman = new RomanEngine(reading)
  const full = roman.hint
  if (!kana) return { typed: full.slice(0, keys), remaining: full.slice(keys) }
  // Kana CPU consumes separate dakuten strokes. Don't advance the roman syllable
  // until its complete NFD reading has been accepted.
  const composed = reading.normalize('NFC')
  let nfd = 0,
    position = 0
  for (const char of composed) {
    nfd += char.normalize('NFD').length
    if (nfd > keys) break
    position += char.length
  }
  let typed = '',
    candidate = ''
  for (const char of full) {
    if (roman.position >= position) break
    if (!roman.feed(char)) break
    candidate += char
    if (
      roman.position <= position &&
      roman.states.some((s) => !s.rest && s.pos === roman.position)
    )
      typed = candidate
  }
  return { typed, remaining: full.slice(typed.length) }
}
