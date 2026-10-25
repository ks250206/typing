import type { Layout } from './engine'
export interface RecordEntry {
  id: string
  passageId: string
  title: string
  layout: Layout
  date: string
  elapsed: number
  keys: number
  misses: number
  kpm: number
  accuracy: number
}
export interface Settings {
  layout: Layout
  background: boolean
  guide: boolean
}
export const defaultSettings: Settings = {
  layout: 'jis',
  background: true,
  guide: true,
}
const HISTORY = 'yohaku.history.v1',
  SETTINGS = 'yohaku.settings.v1'
const layouts = ['jis', 'us', 'dvorak', 'kana']
export function readHistory(): RecordEntry[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(HISTORY) ?? '[]')
    return Array.isArray(data)
      ? data
          .filter(
            (r): r is RecordEntry =>
              !!r &&
              typeof r.id === 'string' &&
              typeof r.passageId === 'string' &&
              typeof r.title === 'string' &&
              layouts.includes(r.layout) &&
              typeof r.date === 'string' &&
              Number.isFinite(Date.parse(r.date)) &&
              ['elapsed', 'keys', 'misses', 'kpm', 'accuracy'].every(
                (k) =>
                  typeof r[k] === 'number' &&
                  Number.isFinite(r[k]) &&
                  r[k] >= 0,
              ),
          )
          .slice(0, 200)
      : []
  } catch {
    return []
  }
}
export function readSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS) ?? '{}')
    return {
      layout: layouts.includes(s?.layout) ? s.layout : 'jis',
      background: typeof s?.background === 'boolean' ? s.background : true,
      guide: typeof s?.guide === 'boolean' ? s.guide : true,
    }
  } catch {
    return defaultSettings
  }
}
export function saveHistory(data: RecordEntry[]) {
  return save(HISTORY, data.slice(0, 200))
}
export function saveSettings(data: Settings) {
  return save(SETTINGS, data)
}
function save(key: string, data: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}
