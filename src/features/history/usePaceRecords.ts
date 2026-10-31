import { useEffect, useMemo, useRef, useState } from 'react'
import type { RecordEntry } from '../../domain/records/types'
import {
  PACE_WINDOW,
  summarizePace,
  type PaceSummary,
} from '../../domain/records/pace'
import { readTraces } from '../../infrastructure/persistence/traceStore'

/** Recover only the requested records, retaining summaries instead of large logs. */
export function usePaceRecords(records: RecordEntry[], enabled = true) {
  const attempted = useRef(new Set<string>())
  const [recovered, setRecovered] = useState(
    new Map<string, PaceSummary | undefined>(),
  )
  useEffect(() => {
    if (!enabled) return
    let active = true
    const missing = records.filter(
      (r) =>
        !r.trace &&
        r.hasTrace &&
        !attempted.current.has(r.id) &&
        (!r.pace || (r.pace.samples >= PACE_WINDOW && !r.pace.moving)),
    )
    void (async () => {
      for (let i = 0; i < missing.length; i += 20) {
        const batch = missing.slice(i, i + 20)
        const traces = await readTraces(batch.map((r) => r.id))
        if (!active) return
        const summaries = batch.map((r) => {
          attempted.current.add(r.id)
          return [
            r.id,
            traces[r.id] ? summarizePace(traces[r.id]) : undefined,
          ] as const
        })
        setRecovered((previous) => new Map([...previous, ...summaries]))
      }
    })()
    return () => {
      active = false
    }
  }, [records, enabled])
  return useMemo(
    () =>
      records.map((r) =>
        recovered.get(r.id) ? { ...r, pace: recovered.get(r.id) } : r,
      ),
    [records, recovered],
  )
}
