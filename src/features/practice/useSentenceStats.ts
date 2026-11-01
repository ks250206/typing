import { useEffect, useState } from 'react'
import {
  readSentenceStats,
  saveSentenceStats,
  SENTENCE_STATS_CLEARED,
} from '../../infrastructure/persistence/sentenceStats'
import { updateSentenceStats } from '../../domain/records/sentencePractice'
import type { RecordEntry } from '../../domain/records/types'
export function useSentenceStats(onNotice: (message: string) => void) {
  const [stats, setStats] = useState(readSentenceStats)
  useEffect(() => {
    const clear = () => setStats({})
    window.addEventListener(SENTENCE_STATS_CLEARED, clear)
    return () => window.removeEventListener(SENTENCE_STATS_CLEARED, clear)
  }, [])
  useEffect(() => {
    try {
      saveSentenceStats(stats)
    } catch {
      onNotice('文別の統計を保存できません。この画面では引き続き確認できます。')
    }
  }, [stats, onNotice])
  return {
    stats,
    recordAttempt: (key: string, record: RecordEntry) =>
      setStats((rows) => ({
        ...rows,
        [key]: updateSentenceStats(rows[key], record),
      })),
  }
}
