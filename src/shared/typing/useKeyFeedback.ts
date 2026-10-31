import { useCallback, useEffect, useRef, useState } from 'react'

export interface MissedKey {
  code: string
  serial: number
}
/** Physical feedback is transient UI state, independent of recorded logical input. */
export function useKeyFeedback() {
  const [missedKey, setMissedKey] = useState<MissedKey | null>(null)
  const serial = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const clearKeyFeedback = useCallback(() => {
    clearTimeout(timer.current)
    setMissedKey(null)
  }, [])
  const reportMiss = (code: string) => {
    clearTimeout(timer.current)
    setMissedKey({ code, serial: ++serial.current })
    timer.current = setTimeout(() => setMissedKey(null), 600)
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  return { missedKey, reportMiss, clearKeyFeedback }
}
