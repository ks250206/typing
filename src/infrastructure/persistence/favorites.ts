import { battleSets } from '../../domain/content/battleSets'
import { practicePassages } from '../../domain/content/practiceDocument'
import { favoriteKey, type Favorite } from '../../domain/records/favorites'
import { layoutLabels } from '../../domain/typing/engine'

export const FAVORITES_STORAGE_KEY = 'galactype.favorites.v1'
export function readFavorites(): Favorite[] {
  try {
    const rows: unknown = JSON.parse(
      localStorage.getItem(FAVORITES_STORAGE_KEY) ?? '[]',
    )
    if (!Array.isArray(rows)) return []
    const favorites = new Map<string, Favorite>()
    for (const row of rows) {
      if (
        !row ||
        typeof row !== 'object' ||
        !Object.hasOwn(layoutLabels, row.layout)
      )
        continue
      const base = { passageId: row.passageId, layout: row.layout }
      let favorite: Favorite
      if (
        row.kind === 'practice' &&
        practicePassages.some((p) => p.id === row.passageId)
      )
        favorite = { kind: 'practice', ...base }
      else if (
        row.kind === 'cpu' &&
        battleSets.some((p) => p.id === row.passageId)
      ) {
        const config = row.cpuConfig
        if (
          !config ||
          !Number.isFinite(config.kpm) ||
          config.kpm < 35 ||
          config.kpm > 1800 ||
          !Number.isFinite(config.reactionMs) ||
          config.reactionMs < 100 ||
          config.reactionMs > 1500 ||
          !['constant', 'ease-in'].includes(config.curve)
        )
          continue
        favorite = {
          kind: 'cpu',
          ...base,
          cpuConfig: {
            kpm: config.kpm,
            reactionMs: config.reactionMs,
            curve: config.curve,
          },
        }
      } else continue
      favorites.set(favoriteKey(favorite), favorite)
    }
    return [...favorites.values()]
  } catch {
    return []
  }
}
export function saveFavorites(favorites: Favorite[]) {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites))
    return true
  } catch {
    return false
  }
}
