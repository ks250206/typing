import { practicePassages } from '../../domain/content/practiceDocument'
import {
  defaultSentenceGoals,
  normalizeSentenceGoals,
  type SentenceGoals,
} from '../../domain/typing/sentenceChallenge'

const key = 'galactype.sentence-practice.v1'
export interface SentencePracticeSettings extends SentenceGoals {
  passageId: string
}
export const defaultSentencePracticeSettings: SentencePracticeSettings = {
  ...defaultSentenceGoals,
  passageId: practicePassages[0].id,
}
export function readSentencePracticeSettings(): SentencePracticeSettings {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return defaultSentencePracticeSettings
    const row = value as Partial<SentencePracticeSettings>
    return {
      ...normalizeSentenceGoals(row),
      passageId: practicePassages.some((p) => p.id === row.passageId)
        ? row.passageId!
        : defaultSentencePracticeSettings.passageId,
    }
  } catch {
    return defaultSentencePracticeSettings
  }
}
export function saveSentencePracticeSettings(config: SentencePracticeSettings) {
  localStorage.setItem(key, JSON.stringify(config))
}
