import { freshSeed } from '../../domain/content/typewell'

export function readPracticeSeed() {
  try {
    const saved = JSON.parse(
      localStorage.getItem('yohaku.typewell.v1') ?? 'null',
    )
    if (
      saved?.fixed &&
      typeof saved.seed === 'string' &&
      saved.seed.length > 0 &&
      saved.seed.length <= 64
    )
      return {
        seed: saved.seed,
        fixed: true,
        version: saved.version === 2 ? (2 as const) : (1 as const),
      }
  } catch {
    /* A fresh seed also works without storage. */
  }
  return { seed: freshSeed(), fixed: false, version: 2 as const }
}

export function savePracticeSeed(preferences: {
  seed: string
  fixed: boolean
  version: 1 | 2
}) {
  try {
    localStorage.setItem('yohaku.typewell.v1', JSON.stringify(preferences))
  } catch {
    /* Keep playing without persistence. */
  }
}
