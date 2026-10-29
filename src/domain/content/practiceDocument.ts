import type { Layout } from '../typing/engine'
import {
  constitutionArticleDocument,
  isConstitutionArticles,
} from './constitutionArticles'
import { etypingDocument, isEtyping } from './etyping'
import { passages as essayPassages } from './passages'
import { isRtc, rtcDocument, rtcPassages } from './rtcWords'
import { sentencesByPassage } from './sentences'
import { isTypewell, typewellDocument, typewellPassages } from './typewell'

export const practicePassages = [
  ...essayPassages,
  ...typewellPassages,
  ...rtcPassages,
]
export function practiceDocument(
  id: string,
  seed: string,
  layout: Layout,
  version: 1 | 2,
) {
  return isConstitutionArticles(id)
    ? constitutionArticleDocument(seed)
    : isTypewell(id)
      ? typewellDocument(id, seed, layout, version)
      : isRtc(id)
        ? rtcDocument(id, seed)
        : isEtyping(id)
          ? etypingDocument(id, seed)
          : {
              passage: practicePassages.find((p) => p.id === id)!,
              sentences: sentencesByPassage[id],
              plan: null,
            }
}
