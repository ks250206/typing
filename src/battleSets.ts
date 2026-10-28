import { battlePrompts } from './battlePrompts'
import { passages } from './passages'
import { sentencesByPassage } from './sentences'
import {
  isTypewell,
  seededRandom,
  typewellPassages,
  typewellPromptPool,
} from './typewell'
export const battleSets = [
  { id: 'cpu-rtc', title: 'RTCオリジナル' },
  ...passages,
  ...typewellPassages,
].map((p) => ({ id: p.id, title: p.title }))
/** The match can consume at most 7 × 19 prompts. Same seed reproduces every round. */
export function seededBattlePrompts(id: string, seed: string) {
  const source =
    id === 'cpu-rtc'
      ? battlePrompts
      : isTypewell(id)
        ? typewellPromptPool(id)
        : sentencesByPassage[id]
  if (!source?.length) throw new Error(`Unknown battle set: ${id}`)
  const random = seededRandom(`rtc-v1/${id}/${seed}`)
  const result = []
  while (result.length < 133) {
    const pool = [...source]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    if (pool.length > 1 && result.at(-1)?.text === pool[0].text)
      [pool[0], pool[1]] = [pool[1], pool[0]]
    result.push(...pool.slice(0, 133 - result.length))
  }
  return result
}
