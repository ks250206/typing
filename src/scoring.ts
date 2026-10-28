/** Correct KPM × adjusted accuracy². Misses may be fractional streak penalties. */
export function scorePoint(keys: number, misses: number, elapsedMs: number) {
  if (keys <= 0 || elapsedMs <= 0 || !Number.isFinite(elapsedMs)) return 0
  const accuracy = keys / (keys + Math.max(0, misses))
  return Math.max(0, Math.floor(((keys * 60000) / elapsedMs) * accuracy ** 2))
}
export const animalRanks = [
  [0, 'カメ'],
  [100, 'ハリネズミ'],
  [200, 'リス'],
  [300, 'ネコ'],
  [400, 'キツネ'],
  [500, 'ウサギ'],
  [650, 'ダチョウ'],
  [800, 'プロングホーン'],
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
