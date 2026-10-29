import { useEffect, useRef, useState } from 'react'
import { recordPoint, recordTitle } from '../../domain/records/recordStats'
import type { RecordEntry } from '../../domain/records/types'
import {
  appendHistory,
  clearHistory,
  mergeHistory,
  readBestHistory,
  readHistory,
  subscribeHistory,
} from '../../infrastructure/persistence/storage'
import { readTraces } from '../../infrastructure/persistence/traceStore'

export function useHistory(setNotice: (message: string) => void) {
  const [confirmClear, setConfirmClear] = useState(false)
  const [records, setRecords] = useState(readHistory)
  const [bestRecords, setBestRecords] = useState(readBestHistory)
  const [detail, setDetail] = useState<RecordEntry | null>(null)
  const [detailReplay, setDetailReplay] = useState(false)
  const unsavedRecords = useRef<RecordEntry[]>([])
  useEffect(
    () =>
      subscribeHistory((latest) => {
        setRecords(mergeHistory(latest, unsavedRecords.current))
        setBestRecords(readBestHistory())
        setDetail(null)
      }),
    [],
  )
  const persistResult = (result: RecordEntry) => {
    void appendHistory(result, unsavedRecords.current).then(
      ({ records: latest, bests, saved }) => {
        setBestRecords(bests)
        if (saved)
          unsavedRecords.current = unsavedRecords.current.filter(
            (r) => !latest.some((item) => item.id === r.id),
          )
        else {
          unsavedRecords.current = mergeHistory(unsavedRecords.current, [
            result,
          ])
          setNotice('記録を保存できません。JSON を書き出して保管してください。')
        }
        setRecords(mergeHistory(latest, unsavedRecords.current))
      },
    )
  }
  const exportRecords = async () => {
    const all = [
      ...new Map([...bestRecords, ...records].map((r) => [r.id, r])).values(),
    ]
    const traces = await readTraces(all.map((r) => r.id))
    for (const r of all) if (r.trace) traces[r.id] = r.trace
    const clean = (rows: RecordEntry[]) =>
      rows.map(({ trace, ...r }) => {
        void trace
        return { ...r, point: recordPoint(r), rank: recordTitle(r) }
      })
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              version: 2,
              records: clean(records),
              bestRecords: clean(bestRecords),
              traces,
            },
            null,
            2,
          ),
        ],
        {
          type: 'application/json',
        },
      ),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = 'galactype-records.json'
    a.click()
    URL.revokeObjectURL(url)
  }
  const clearRecords = async () => {
    if (await clearHistory()) {
      unsavedRecords.current = []
      setBestRecords([])
      setDetail(null)
      setRecords([])
      return true
    }
    setNotice('削除できませんでした。ブラウザの保存設定を確認してください。')
    return false
  }
  return {
    confirmClear,
    requestClear: () => setConfirmClear(true),
    cancelClear: () => setConfirmClear(false),
    records,
    bestRecords,
    detail,
    detailReplay,
    persistResult,
    exportRecords,
    clearRecords,
    selectDetail: (record: RecordEntry, replay = false) => {
      setDetailReplay(replay)
      setDetail(record)
    },
    closeDetail: () => setDetail(null),
  }
}
export type HistoryController = ReturnType<typeof useHistory>
