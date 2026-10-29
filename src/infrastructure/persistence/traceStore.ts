import type { SessionTrace } from '../../domain/records/telemetry'
import { validTrace } from '../../domain/records/telemetry'
const DB = 'galactype.telemetry.v1'
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(Error('IndexedDB unavailable'))
      return
    }
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('traces')
    let blocked = false
    request.onsuccess = () => {
      if (blocked) request.result.close()
      else resolve(request.result)
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => {
      blocked = true
      reject(Error('IndexedDB blocked'))
    }
  })
}
export async function writeTraces(
  entries: { id: string; trace?: SessionTrace }[],
  retained?: string[],
) {
  if (!entries.length && typeof indexedDB === 'undefined') return true
  let db: IDBDatabase | undefined
  try {
    db = await open()
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction('traces', 'readwrite'),
        store = tx.objectStore('traces')
      for (const r of entries) if (r.trace) store.put(r.trace, r.id)
      const keep = new Set(retained ?? [])
      const cursor = retained ? store.openKeyCursor() : null
      if (cursor)
        cursor.onsuccess = () => {
          const c = cursor.result
          if (c) {
            if (!keep.has(String(c.key))) store.delete(c.key)
            c.continue()
          }
        }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    return true
  } catch {
    return false
  } finally {
    db?.close()
  }
}
export async function readTraces(
  ids: string[],
): Promise<Record<string, SessionTrace>> {
  if (!ids.length) return {}
  let db: IDBDatabase | undefined
  try {
    db = await open()
    return await new Promise((resolve, reject) => {
      const result: Record<string, SessionTrace> = {}
      const tx = db!.transaction('traces'),
        store = tx.objectStore('traces')
      for (const id of new Set(ids)) {
        const r = store.get(id)
        r.onsuccess = () => {
          if (validTrace(r.result)) result[id] = r.result
        }
      }
      tx.oncomplete = () => resolve(result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } catch {
    return {}
  } finally {
    db?.close()
  }
}
export async function readTrace(id: string) {
  return (await readTraces([id]))[id]
}
