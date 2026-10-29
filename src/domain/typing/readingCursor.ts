/** Keep a composed kana highlighted while its separate dakuten is still pending. */
export function readingCursor(target: string, position: number) {
  const composed = target.normalize('NFC')
  const decomposed = target !== composed
  let offset = 0
  let displayOffset = 0
  for (const char of composed) {
    const length = char.normalize(decomposed ? 'NFD' : 'NFC').length
    if (position < offset + length)
      return {
        before: composed.slice(0, displayOffset),
        current: char,
        after: composed.slice(displayOffset + char.length),
      }
    offset += length
    displayOffset += char.length
  }
  return { before: composed, current: '', after: '' }
}
