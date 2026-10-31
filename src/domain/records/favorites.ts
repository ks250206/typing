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
