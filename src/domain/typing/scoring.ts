/** Correct KPM × adjusted accuracy². Misses may be fractional streak penalties. */
export function scorePoint(keys: number, misses: number, elapsedMs: number) {
  if (keys <= 0 || elapsedMs <= 0 || !Number.isFinite(elapsedMs)) return 0
  const accuracy = keys / (keys + Math.max(0, misses))
  return Math.max(0, Math.floor(((keys * 60000) / elapsedMs) * accuracy ** 2))
}
// An original game progression inspired by running speed, not measured speed tiers.
export const animalRanks = [
  [0, 'カメ'],
  [50, 'ハリネズミ'],
  [100, 'コアラ'],
  [150, 'リス'],
  [200, 'アライグマ'],
  [250, 'パンダ'],
  [300, 'タヌキ'],
  [350, 'ネコ'],
  [400, 'キツネ'],
  [450, 'イヌ'],
  [500, 'ウサギ'],
  [550, 'シマウマ'],
  [600, 'シカ'],
  [650, 'カンガルー'],
  [700, 'サラブレッド'],
  [750, 'ダチョウ'],
  [800, 'ヌー'],
  [850, 'ガゼル'],
  [900, 'スプリングボック'],
  [950, 'プロングホーン'],
  [1000, 'チーター'],
] as const
export function animalRank(point: number) {
  return (
    animalRanks.findLast(([threshold]) => point >= threshold)?.[1] ?? 'カメ'
  )
}
/** Keep episode/raw counts for accuracy; pt uses a diminishing, nonzero streak penalty. */
export class MissEpisodes {
  misses = 0
  raw = 0
  private blocked = false
  private streak = 0
  private penaltyUnits = 0
  get penalty() {
    return this.penaltyUnits / 100
  }
  miss() {
    this.raw++
    this.penaltyUnits += [100, 75, 50, 35, 25][Math.min(this.streak++, 4)]
    if (this.blocked) return false
    this.blocked = true
    this.misses++
    return true
  }
  accept() {
    this.blocked = false
    this.streak = 0
  }
}

/** Bounds are inclusive; zero is a dedicated no-miss title. */
export const missPrefixes = [
  [0, '星々に祝福されし'],
  [0.5, '至高の'],
  [1, '研ぎ澄まされた'],
  [2, '精緻な'],
  [3, '堅実な'],
  [5, '歴戦の'],
  [8, '荒削りな'],
  [12, '暴走する'],
  [Infinity, '混沌の'],
] as const
export function rawMissRate(keys: number, misses: number) {
  return keys + misses > 0 ? (misses / (keys + misses)) * 100 : 0
}
export function typingTitle(point: number, keys: number, misses: number) {
  const total = keys + misses
  if (total <= 0) return animalRank(point)
  // Compare counts before rounding the displayed percentage.
  const prefix = missPrefixes.find(
    ([upper]) => misses * 100 <= total * upper,
  )![1]
  return `${prefix}${animalRank(point)}`
}
export function formatMissRate(keys: number, misses: number) {
  const rate = rawMissRate(keys, misses)
  return rate > 0 && rate < 0.0001 ? '<0.0001%' : `${Number(rate.toFixed(4))}%`
}
