import { cpuPresets, migrateCpuPreset } from '../../domain/battle/cpuMatch'
import type { CpuConfig } from '../../domain/battle/cpuMatch'
import { battleSets } from '../../domain/content/battleSets'
import { freshSeed } from '../../domain/content/typewell'

export const CPU_CONFIG_STORAGE_KEY = 'yohaku.cpu.v1'
export const CPU_PROMPTS_STORAGE_KEY = 'galactype.cpu-prompts.v1'

export interface CpuPromptSelection {
  id: string
  seed: string
  fixed: boolean
  /** Raw saved count; callers normalize it for TypeWell sets only. */
  wordsPerPrompt?: unknown
}

export function readCpuConfig(): CpuConfig {
  try {
    const value = JSON.parse(
      localStorage.getItem(CPU_CONFIG_STORAGE_KEY) ?? 'null',
    )
    if (
      value &&
      Number.isFinite(value.kpm) &&
      value.kpm >= 35 &&
      value.kpm <= 1800 &&
      Number.isFinite(value.reactionMs) &&
      value.reactionMs >= 100 &&
      value.reactionMs <= 1500 &&
      ['constant', 'ease-in'].includes(value.curve)
    )
      return migrateCpuPreset(value)
  } catch {
    /* Defaults also work without storage. */
  }
  return cpuPresets.find((p) => p.name === 'ネコ')!
}

export function readCpuPromptSelection(): CpuPromptSelection {
  try {
    const saved = JSON.parse(
      localStorage.getItem(CPU_PROMPTS_STORAGE_KEY) ?? 'null',
    )
    if (
      saved &&
      battleSets.some((s) => s.id === saved.id) &&
      typeof saved.seed === 'string' &&
      saved.seed.length > 0 &&
      saved.seed.length <= 64
    )
      return {
        id: saved.id,
        seed: saved.seed,
        fixed: !!saved.fixed,
        wordsPerPrompt: saved.wordsPerPrompt,
      }
  } catch {
    /* Defaults also work without storage. */
  }
  return { id: 'cpu-rtc', seed: freshSeed(), fixed: false }
}

export function saveCpuConfig(config: CpuConfig) {
  save(CPU_CONFIG_STORAGE_KEY, config)
}

export function saveCpuPromptSelection(selection: CpuPromptSelection) {
  save(CPU_PROMPTS_STORAGE_KEY, selection)
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* Play without saved preferences. */
  }
}
