import { expect, it } from 'vitest'
import highSpeed from './data/trainer-sources/trainer-high-speed.json'
import longform from './data/trainer-sources/trainer-longform.json'
import { trainerPassages, isTrainer, createTrainerOrder } from './sakusaku'
import { sentencesByPassage } from './sentences'
import { battleSets, seededBattlePrompts } from './battleSets'

it.each([
  [highSpeed, 18],
  [longform, 15],
] as const)(
  'preserves all source pairs, ruby and trainer integrations for $0.id',
  (source, length) => {
    const passage = trainerPassages.find((p) => p.id === source.id)!
    const sentences = sentencesByPassage[source.id]
    expect(passage.durationMs).toBe(60000)
    expect(passage.source?.url).toBe(source.source.url)
    expect(source.source.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(sentences).toHaveLength(length)
    expect(source.view.at(-1)).toBe('')
    expect(sentences.map((s) => [s.text, s.reading])).toEqual(
      source.view.slice(0, -1).map((text, i) => [text, source.input[i]]),
    )
    for (const sentence of sentences) {
      expect(sentence.segments.map((s) => s.text).join('')).toBe(sentence.text)
      expect(sentence.segments.map((s) => s.reading).join('')).toBe(
        sentence.reading,
      )
    }
    expect(isTrainer(source.id)).toBe(true)
    expect(battleSets.some((p) => p.id === source.id)).toBe(true)
    const prompts = seededBattlePrompts(source.id, 'imported-trainer')
    expect(prompts).toHaveLength(133)
    expect(prompts).toEqual(seededBattlePrompts(source.id, 'imported-trainer'))
    expect(
      prompts.every((p) =>
        sentences.some((s) => s.text === p.text && s.reading === p.reading),
      ),
    ).toBe(true)
    const order = () => {
      const next = createTrainerOrder('trainer-import', length)
      return Array.from({ length: 1000 }, () => next())
    }
    const sequence = order()
    expect(sequence).toEqual(order())
    expect(new Set(sequence).size).toBe(length)
    expect(sequence.every((n, i) => !i || n !== sequence[i - 1])).toBe(true)
  },
)
it('uses source alignment for long kanji readings without guessing and recognizes only trainer ids', () => {
  expect(sentencesByPassage[highSpeed.id][0].segments).toContainEqual({
    text: '消防士',
    reading: 'しょうぼうし',
  })
  expect(sentencesByPassage[longform.id][4].segments).toContainEqual({
    text: '腱鞘炎',
    reading: 'けんしょうえん',
  })
  expect(isTrainer('sakusaku-trainer')).toBe(true)
  expect(isTrainer('night-library')).toBe(false)
})
