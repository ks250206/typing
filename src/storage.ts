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
  point?: number
  rank?: string
  rawMisses?: number
  scoreVersion?: number
  mode?: 'practice' | 'cpu'
}
export interface Settings {
  layout: Layout
  background: boolean
  wordColors: boolean
  consumeTyped: boolean
  guide: boolean
}
export const defaultSettings: Settings = {
  layout: 'jis',
  background: true,
  guide: true,
  wordColors: true,
  consumeTyped: false,
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
      wordColors: typeof s?.wordColors === 'boolean' ? s.wordColors : true,
      consumeTyped:
        typeof s?.consumeTyped === 'boolean' ? s.consumeTyped : false,
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

// Share one lock for appends and deletion so simultaneous tabs cannot overwrite
// each other's read-modify-write operations. HTTPS/localhost provides Web Locks.
function withHistoryLock<T>(operation: () => T): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(HISTORY, operation)
  }
  return Promise.resolve(operation())
}
export function mergeHistory(...groups: RecordEntry[][]): RecordEntry[] {
  return [...new Map(groups.flat().map((entry) => [entry.id, entry])).values()]
    .sort(
      (a, b) =>
        Date.parse(b.date) - Date.parse(a.date) || b.id.localeCompare(a.id),
    )
    .slice(0, 200)
}
export function appendHistory(entry: RecordEntry, unsaved: RecordEntry[] = []) {
  return withHistoryLock(() => {
    const records = mergeHistory(readHistory(), unsaved, [entry])
    return { records, saved: saveHistory(records) }
  })
}
export function clearHistory() {
  return withHistoryLock(() => saveHistory([]))
}
export function subscribeHistory(listener: (records: RecordEntry[]) => void) {
  const handle = (event: StorageEvent) => {
    if (
      event.storageArea === localStorage &&
      (event.key === HISTORY || event.key === null)
    )
      listener(readHistory())
  }
  window.addEventListener('storage', handle)
  return () => window.removeEventListener('storage', handle)
}
