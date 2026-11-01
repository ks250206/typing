import {
  isTypewellBattle,
  normalizeCpuWordsPerPrompt,
} from '../battle/cpuPromptSettings'
import {
  englishPassages,
  englishPromptPool,
  englishSentence,
  isEnglish,
} from './english'
import type { Sentence } from './sentences'
import { rtcPassages, isRtc, rtcPrompts } from './rtcWords'
import { battlePrompts, legacyBattlePrompts } from './battlePrompts'
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
  ...rtcPassages,
  ...englishPassages,
].map((p) => ({
  id: p.id,
  title: p.title,
  language:
    'language' in p && p.language === 'en' ? ('en' as const) : ('ja' as const),
}))
/** Non-TypeWell sets retain their existing version; old one-word matches use v1. */
export const battlePromptVersion = (id: string, version: 1 | 2) =>
  id === 'cpu-rtc' || isTypewellBattle(id) ? version : 1
function joinedWordPrompt(words: Sentence[]): Sentence {
  if (words[0].language === 'en')
    return englishSentence(words.map((word) => word.text).join(' '))
  const segments: Sentence['segments'] = []
  const wordStarts: number[] = []
  let offset = 0
  words.forEach((word, index) => {
    if (index) {
      segments.push({ text: ' ', reading: ' ' })
      offset++
      wordStarts.push(offset)
    }
    segments.push(...word.segments)
    offset += word.text.length
  })
  return {
    text: words.map((word) => word.text).join(' '),
    reading: words.map((word) => word.reading).join(' '),
    segments,
    wordStarts,
  }
}
/** The match can consume at most 7 × 19 prompts. Same seed reproduces every round. */
export function seededBattlePrompts(
  id: string,
  seed: string,
  version: 1 | 2 = 2,
  wordsPerPrompt = 5,
) {
  if (isRtc(id)) return rtcPrompts(id, seed, 133)
  const source =
    id === 'cpu-rtc'
      ? version === 1
        ? legacyBattlePrompts
        : battlePrompts
      : isEnglish(id)
        ? englishPromptPool(id, false)
        : isTypewell(id)
          ? typewellPromptPool(id)
          : sentencesByPassage[id]
  if (!source?.length) throw new Error(`Unknown battle set: ${id}`)
  const random = seededRandom(`rtc-v1/${id}/${seed}`)
  const grouped = isTypewellBattle(id) && version === 2
  const size = normalizeCpuWordsPerPrompt(wordsPerPrompt)
  const count = grouped ? 133 * size : 133
  const result: Sentence[] = []
  while (result.length < count) {
    const pool = [...source]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    if (pool.length > 1 && result.at(-1)?.text === pool[0].text)
      [pool[0], pool[1]] = [pool[1], pool[0]]
    result.push(...pool.slice(0, count - result.length))
  }
  return grouped
    ? Array.from({ length: 133 }, (_, index) =>
        joinedWordPrompt(result.slice(index * size, index * size + size)),
      )
    : result
}
