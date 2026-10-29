import { expect, it } from 'vitest'
import { passages } from '../../domain/content/passages'
import { typewellPassages } from '../../domain/content/typewell'
import { libraryCategory } from './libraryCategories'
import { seededRandom } from '../../domain/content/typewell'
import { createTrainerOrder, randomSentenceIndex } from '../../domain/content/sakusaku'
it('groups both constitution sets, the six original essays, and all five TypeWell sets', () => {
  expect(
    passages.filter((p) => libraryCategory(p) === '公的文書').map((p) => p.id),
  ).toEqual(['constitution-preamble', 'constitution-articles'])
  expect(
    passages
      .filter((p) => libraryCategory(p) === 'オリジナル')
      .map((p) => p.genre),
  ).toEqual(['文学', '旅', '科学', '日常', '思索', '音楽'])
  expect(typewellPassages).toHaveLength(5)
  expect(
    typewellPassages.every((p) => libraryCategory(p) === 'タイプウェル'),
  ).toBe(true)
  expect(
    typewellPassages.find((p) => p.id === 'typewell-space')!.title,
  ).toContain('タイプウェル準拠')
})
it('reproduces v1 trainer streams unchanged for saved records', () => {
  const random = seededRandom('sakusaku-v1/legacy')
  const next = createTrainerOrder('legacy', 15, 1)
  let previous = -1
  for (let i = 0; i < 100; i++) {
    previous = randomSentenceIndex(15, previous, random)
    expect(next()).toBe(previous)
  }
})
