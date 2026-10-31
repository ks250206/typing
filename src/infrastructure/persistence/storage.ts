import type { RecordEntry, Settings } from '../../domain/records/types'
import { archiveBests } from '../../domain/records/recordStats'
import { writeTraces } from './traceStore'
import { layoutLabels } from '../../domain/typing/engine'
import { summarizePace, validPace } from '../../domain/records/pace'
export const defaultSettings: Settings = {
  layout: 'jis',
  background: true,
  wordColors: true,
  consumeTyped: false,
  navigationMotion: 'on',
}
const HISTORY = 'yohaku.history.v1',
  SETTINGS = 'yohaku.settings.v1'
const BESTS = 'galactype.bests.v1'
const layouts = Object.keys(layoutLabels)
function readRecords(key: string, limit: number): RecordEntry[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
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
          .map((record): RecordEntry => ({
            ...record,
            trace: undefined,
            pace: validPace(record.pace) ? record.pace : undefined,
            mode:
              record.mode === 'practice' ||
              record.mode === 'cpu' ||
              record.mode === 'trainer' ||
              record.mode === 'ghost' ||
              record.mode === 'weak'
                ? record.mode
                : undefined,
            ghostSourceId:
              typeof record.ghostSourceId === 'string'
                ? record.ghostSourceId
                : undefined,
            rawMisses:
              typeof record.rawMisses === 'number' &&
              Number.isFinite(record.rawMisses) &&
              record.rawMisses >= 0
                ? record.rawMisses
                : undefined,
            hasTrace: record.hasTrace === true ? true : undefined,
            cpuConfig:
              record.cpuConfig &&
              Number.isFinite(record.cpuConfig.kpm) &&
              record.cpuConfig.kpm >= 35 &&
              record.cpuConfig.kpm <= 1800 &&
              Number.isFinite(record.cpuConfig.reactionMs) &&
              record.cpuConfig.reactionMs >= 100 &&
              record.cpuConfig.reactionMs <= 1500 &&
              ['constant', 'ease-in'].includes(record.cpuConfig.curve)
                ? record.cpuConfig
                : undefined,
            replayVersion:
              record.replayVersion === 2
                ? 2
                : record.replayVersion === 1
                  ? 1
                  : undefined,
            missPenalty:
              typeof record.missPenalty === 'number' &&
              Number.isFinite(record.missPenalty) &&
              record.missPenalty >= 0
                ? record.missPenalty
                : undefined,
            seed:
              typeof record.seed === 'string' &&
              record.seed.length > 0 &&
              record.seed.length <= 64
                ? record.seed
                : undefined,
            strokeLimit:
              record.strokeLimit === 400 || record.strokeLimit === 280
                ? record.strokeLimit
                : undefined,
            actualKeys:
              typeof record.actualKeys === 'number' &&
              Number.isFinite(record.actualKeys) &&
              record.actualKeys >= 0
                ? record.actualKeys
                : undefined,
          }))
          .slice(0, limit)
      : []
  } catch {
    return []
  }
}
export const readHistory = () => readRecords(HISTORY, Number.MAX_SAFE_INTEGER)
export const readBestHistory = () =>
  archiveBests(readRecords(BESTS, Number.MAX_SAFE_INTEGER))
function summaries(data: RecordEntry[]) {
  return data.map(({ trace, ...r }) => ({
    ...r,
    pace: trace ? summarizePace(trace) : r.pace,
    hasTrace: r.hasTrace || (trace ? true : undefined),
  }))
}
export function readSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS) ?? '{}')
    return {
      navigationMotion: ['on', 'system', 'off'].includes(s?.navigationMotion)
        ? s.navigationMotion
        : 'on',
      layout: layouts.includes(s?.layout) ? s.layout : 'jis',
      background: typeof s?.background === 'boolean' ? s.background : true,
      wordColors: typeof s?.wordColors === 'boolean' ? s.wordColors : true,
      consumeTyped:
        typeof s?.consumeTyped === 'boolean' ? s.consumeTyped : false,
    }
  } catch {
    return defaultSettings
  }
}
export function saveHistory(data: RecordEntry[]) {
  return save(HISTORY, summaries(data))
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
async function withHistoryLock<T>(operation: () => T | Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return await navigator.locks.request(HISTORY, operation)
  }
  return await operation()
}
export function mergeHistory(...groups: RecordEntry[][]): RecordEntry[] {
  return [
    ...new Map(groups.flat().map((entry) => [entry.id, entry])).values(),
  ].sort(
    (a, b) =>
      Date.parse(b.date) - Date.parse(a.date) || b.id.localeCompare(a.id),
  )
}
export function appendHistory(entry: RecordEntry, unsaved: RecordEntry[] = []) {
  return withHistoryLock(async () => {
    const records = mergeHistory(readHistory(), unsaved, [entry])
    const bests = archiveBests([...readBestHistory(), ...records])
    const retained = [...new Set([...records, ...bests].map((r) => r.id))]
    const tracesSaved = await writeTraces(
      [...records, ...bests].filter((r) => !!r.trace),
      undefined,
    )
    const bestsSaved = save(BESTS, summaries(bests))
    const historySaved = saveHistory(records)
    if (historySaved && bestsSaved && tracesSaved)
      await writeTraces([], retained)
    return { records, bests, saved: historySaved && bestsSaved && tracesSaved }
  })
}
export function clearHistory() {
  return withHistoryLock(async () => {
    const previous = readHistory(),
      bests = readBestHistory()
    const historySaved = saveHistory([]),
      bestsSaved = save(BESTS, [])
    const tracesSaved =
      historySaved && bestsSaved && (await writeTraces([], []))
    if (!tracesSaved) {
      if (historySaved) saveHistory(previous)
      if (bestsSaved) save(BESTS, summaries(bests))
    }
    return tracesSaved
  })
}
export function subscribeHistory(listener: (records: RecordEntry[]) => void) {
  const handle = (event: StorageEvent) => {
    if (
      event.storageArea === localStorage &&
      (event.key === HISTORY || event.key === BESTS || event.key === null)
    )
      listener(readHistory())
  }
  window.addEventListener('storage', handle)
  return () => window.removeEventListener('storage', handle)
}
