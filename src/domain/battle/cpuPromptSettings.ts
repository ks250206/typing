export const defaultCpuWordsPerPrompt = 5
export const maxCpuWordsPerPrompt = 50
export const isTypewellBattle = (id: string) => /^(?:en-)?typewell-/.test(id)
export function normalizeCpuWordsPerPrompt(value: unknown) {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= maxCpuWordsPerPrompt
    ? value
    : defaultCpuWordsPerPrompt
}
