import type { RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
export type PracticeStatus =
  'ready' | 'countdown' | 'running' | 'paused' | 'done'

/** Owns clock resources; the session decides what a deadline or a start means. */
export function usePracticeClock({
  status,
  setStatus,
  durationMs,
  area,
  onStarted,
  onDeadline,
}: {
  status: PracticeStatus
  setStatus: (status: PracticeStatus) => void
  durationMs: number
  area: RefObject<HTMLDivElement | null>
  onStarted: () => void
  onDeadline: (duration: number) => void
}) {
  const [elapsed, setElapsed] = useState(0)
  const [startCount, setStartCount] = useState(3)
  const started = useRef(0)
  const accumulated = useRef(0)
  const revision = useRef(0)
  const countdownDeadline = useRef(0)
  const countdownTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const finish = useRef(onDeadline)
  useEffect(() => {
    finish.current = onDeadline
  }, [onDeadline])
  const elapsedNow = () =>
    accumulated.current +
    (started.current ? performance.now() - started.current : 0)
  const clearCountdown = () => {
    clearTimeout(countdownTimer.current)
    countdownDeadline.current = 0
  }
  const start = () => {
    started.current = performance.now()
  }
  const stop = (duration: number) => {
    accumulated.current = duration
    started.current = 0
    setElapsed(duration)
  }
  const reset = () => {
    clearCountdown()
    revision.current++
    stop(0)
  }
  const beginCountdown = () => {
    const generation = revision.current
    countdownDeadline.current = performance.now() + 3000
    setStartCount(3)
    setStatus('countdown')
    const tick = () => {
      if (generation !== revision.current || !countdownDeadline.current) return
      const remaining = Math.ceil(
        (countdownDeadline.current - performance.now()) / 1000,
      )
      if (remaining > 0) {
        setStartCount(remaining)
        countdownTimer.current = setTimeout(tick, 50)
        return
      }
      clearCountdown()
      if (document.hidden || !area.current?.contains(document.activeElement)) {
        setStatus('ready')
        return
      }
      start()
      onStarted()
      setStatus('running')
    }
    countdownTimer.current = setTimeout(tick, 50)
  }
  useEffect(() => {
    if (status !== 'running') return
    const generation = revision.current
    const timer = setInterval(() => {
      if (revision.current !== generation) return
      const current = accumulated.current + performance.now() - started.current
      if (durationMs && current >= durationMs) finish.current(durationMs)
      else setElapsed(current)
    }, 50)
    return () => clearInterval(timer)
  }, [status, durationMs])
  useEffect(
    () => () => {
      clearTimeout(countdownTimer.current)
      countdownDeadline.current = 0
      revision.current++
    },
    [],
  )
  return {
    elapsed,
    startCount,
    elapsedNow,
    start,
    stop,
    reset,
    beginCountdown,
    isCountingDown: () => !!countdownDeadline.current,
  }
}
