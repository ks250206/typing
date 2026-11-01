/** An in-progress entry such as "4" for a 35–1800 field is kept as text, not applied. */
export function parseBoundedInteger(text: string, min: number, max: number) {
  if (text.trim() === '') return undefined
  const value = Number(text)
  return Number.isInteger(value) && value >= min && value <= max
    ? value
    : undefined
}

/** On commit, an empty or invalid draft keeps the last value; others are clamped. */
export function commitBoundedInteger(
  text: string,
  min: number,
  max: number,
  fallback: number,
) {
  const value = text.trim() === '' ? NaN : Math.trunc(Number(text))
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}
