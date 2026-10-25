import { beforeEach, expect, it, vi } from 'vitest'
import { readHistory, readSettings, saveHistory, saveSettings } from './storage'
let data: Map<string, string>
beforeEach(() => {
  data = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
  })
})
it('survives corrupt data and null settings', () => {
  data.set('yohaku.history.v1', '{')
  data.set('yohaku.settings.v1', 'null')
  expect(readHistory()).toEqual([])
  expect(readSettings().layout).toBe('jis')
})
it('round trips settings and rejects unknown layouts', () => {
  expect(
    saveSettings({ layout: 'dvorak', background: false, guide: true }),
  ).toBe(true)
  expect(readSettings()).toEqual({
    layout: 'dvorak',
    background: false,
    guide: true,
  })
  data.set('yohaku.settings.v1', '{"layout":"bad"}')
  expect(readSettings().layout).toBe('jis')
})
it('rejects malformed history entries', () => {
  data.set('yohaku.history.v1', '[null,{},1]')
  expect(readHistory()).toEqual([])
})
it('reports unavailable storage without crashing', () => {
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw Error()
    },
    setItem: () => {
      throw Error()
    },
  })
  expect(readHistory()).toEqual([])
  expect(saveHistory([])).toBe(false)
})
