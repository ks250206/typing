export const displayScales = [75, 80, 90, 100, 110, 125, 150] as const
export function validDisplayScale(value: unknown): number {
  return typeof value === 'number' &&
    displayScales.includes(value as (typeof displayScales)[number])
    ? value
    : 100
}
