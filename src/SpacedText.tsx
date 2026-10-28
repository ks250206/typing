import { wordTone } from './wordSpacing'
/** CSS spacing keeps copied text, accessible names and typing targets unchanged. */
export function SpacedText({
  text,
  start = 0,
  boundaries,
  hideBefore = 0,
}: {
  text: string
  start?: number
  boundaries: Set<number>
  hideBefore?: number
}) {
  if (!text) return null
  const cuts = [
    0,
    ...[...boundaries]
      .filter((offset) => offset > start && offset < start + text.length)
      .map((offset) => offset - start)
      .sort((a, b) => a - b),
    text.length,
  ]
  return cuts.slice(0, -1).map((offset, index) => (
    <span
      key={offset}
      data-tone={wordTone(start + offset, boundaries)}
      data-word-anchor={start + offset === hideBefore ? '' : undefined}
      data-consumed={
        hideBefore > 0 && start + cuts[index + 1] <= hideBefore
          ? 'true'
          : undefined
      }
      aria-hidden={
        hideBefore > 0 && start + cuts[index + 1] <= hideBefore
          ? true
          : undefined
      }
      className={boundaries.has(start + offset) ? 'word-start' : undefined}
    >
      {text.slice(offset, cuts[index + 1])}
    </span>
  ))
}
