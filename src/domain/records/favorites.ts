import type { CpuConfig } from '../battle/cpuMatch'
import type { Layout } from '../typing/engine'

export type Favorite =
  | { kind: 'practice'; passageId: string; layout: Layout }
  | { kind: 'cpu'; passageId: string; layout: Layout; cpuConfig: CpuConfig }

/** Seeds deliberately do not participate: favorites always draw a fresh game. */
export const favoriteKey = (favorite: Favorite) =>
  JSON.stringify([
    favorite.kind,
    favorite.passageId,
    favorite.layout,
    ...(favorite.kind === 'cpu'
      ? [
          favorite.cpuConfig.kpm,
          favorite.cpuConfig.reactionMs,
          favorite.cpuConfig.curve,
        ]
      : []),
  ])

/** Accept only a permutation of the complete current list, never a stale subset. */
export function reorderFavorites(
  items: Favorite[],
  order: string[],
): Favorite[] {
  const byKey = new Map(items.map((item) => [favoriteKey(item), item]))
  if (
    order.length !== items.length ||
    new Set(order).size !== items.length ||
    order.some((key) => !byKey.has(key))
  )
    return items
  if (order.every((key, index) => key === favoriteKey(items[index])))
    return items
  return order.map((key) => byKey.get(key)!)
}
