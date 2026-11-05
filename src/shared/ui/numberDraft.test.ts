import { describe, expect, it } from 'vite-plus/test'
import { commitBoundedInteger, parseBoundedInteger } from './numberDraft'

describe('parseBoundedInteger', () => {
  it('applies only complete in-range integers while typing', () => {
    expect(
      ['4', '40', '400'].map((t) => parseBoundedInteger(t, 35, 1800)),
    ).toEqual([undefined, 40, 400])
  })
  it('ignores empty, fractional and out-of-range drafts', () => {
    for (const text of ['', ' ', '-', '1e', '40.5', '34', '1801'])
      expect(parseBoundedInteger(text, 35, 1800)).toBeUndefined()
  })
})

describe('commitBoundedInteger', () => {
  it('clamps out-of-range drafts on commit', () => {
    expect(commitBoundedInteger('4', 35, 1800, 300)).toBe(35)
    expect(commitBoundedInteger('5000', 35, 1800, 300)).toBe(1800)
    expect(commitBoundedInteger('12.9', 1, 20, 5)).toBe(12)
  })
  it('keeps the previous value for empty or invalid drafts', () => {
    expect(commitBoundedInteger('', 35, 1800, 300)).toBe(300)
    expect(commitBoundedInteger('-', 1, 20, 5)).toBe(5)
  })
})
