import { useCallback, useEffect, useRef } from 'react'

/** Ease both ends; stop an old scroll when a new selection or manual input arrives. */
export function useScrollTransition() {
  const stop = useRef<() => void>(() => {})
  useEffect(() => () => stop.current(), [])
  return useCallback((container: HTMLElement, target: HTMLElement) => {
    stop.current()
    const from = container.scrollTop
    const to = Math.max(
      0,
      Math.min(
        container.scrollHeight - container.clientHeight,
        from +
          target.getBoundingClientRect().top -
          container.getBoundingClientRect().top,
      ),
    )
    const setting = container
      .closest('[data-navigation-motion]')
      ?.getAttribute('data-navigation-motion')
    const animate =
      setting === 'on' ||
      (setting !== 'off' &&
        !matchMedia('(prefers-reduced-motion: reduce)').matches)
    if (!animate) {
      container.scrollTop = to
      return
    }
    let frame = 0
    const started = performance.now()
    const cancel = () => {
      cancelAnimationFrame(frame)
      container.removeEventListener('wheel', cancel)
      container.removeEventListener('touchstart', cancel)
    }
    stop.current = cancel
    container.addEventListener('wheel', cancel, { passive: true })
    container.addEventListener('touchstart', cancel, { passive: true })
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - started) / 650))
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
      container.scrollTop = from + (to - from) * eased
      if (t < 1) frame = requestAnimationFrame(step)
      else cancel()
    }
    frame = requestAnimationFrame(step)
  }, [])
}
