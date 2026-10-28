import { RomanEngine } from './engine'

type Step = { from: number; to: number; start: number; end: number }
/** Follow the complete spelling, so ambiguous n/nn prefixes use the same path on both rows. */
function spellingPath(reading: string, spelling: string): Step[] {
  const engine = new RomanEngine(reading)
  const failed = new Set<string>()
  const find = (position: number, offset: number): Step[] | undefined => {
    if (position === engine.target.length)
      return offset === spelling.length ? [] : undefined
    const key = `${position}/${offset}`
    if (failed.has(key)) return
    for (const edge of engine.edges(position)) {
      if (!spelling.startsWith(edge.text, offset)) continue
      const rest = find(edge.end, offset + edge.text.length)
      if (rest)
        return [
          {
            from: position,
            to: edge.end,
            start: offset,
            end: offset + edge.text.length,
          },
          ...rest,
        ]
    }
    failed.add(key)
  }
  const path = find(0, 0)
  if (!path) throw new Error('Invalid duel spelling')
  return path
}
function readingProgress(path: Step[], keys: number) {
  const step = path.find((step) => keys < step.end)
  if (!step) return path.at(-1)?.to ?? 0
  return (
    step.from +
    Math.max(0, (keys - step.start) / (step.end - step.start)) *
      (step.to - step.from)
  )
}
function indexAtProgress(path: Step[], progress: number) {
  const step = path.find((step) => progress < step.to)
  if (!step) return path.at(-1)?.end ?? 0
  return (
    step.start +
    Math.floor(
      Math.max(0, (progress - step.from) / (step.to - step.from)) *
        (step.end - step.start) +
        1e-8,
    )
  )
}
function kanaProgress(reading: string, keys: number) {
  let offset = 0,
    decomposed = 0
  for (const char of reading.normalize('NFC')) {
    const length = char.normalize('NFD').length
    if (keys < decomposed + length)
      return offset + Math.max(0, keys - decomposed) / length
    offset++
    decomposed += length
  }
  return offset
}
/** Project the CPU's own fixed typing plan onto the player's displayed spelling.
 * This only changes rendering; CPU speed and match scoring use the original plan.
 */
export function duelProjection(reading: string, display: string) {
  const canonical = new RomanEngine(reading).hint
  const sourcePath = spellingPath(reading, canonical)
  const displayPath = spellingPath(reading, display)
  return (keys: number, kana: boolean) =>
    indexAtProgress(
      displayPath,
      kana ? kanaProgress(reading, keys) : readingProgress(sourcePath, keys),
    )
}
