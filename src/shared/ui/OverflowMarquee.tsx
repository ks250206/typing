import { useLayoutEffect, useRef } from 'react'

/** Single copy of the text: idle ellipsis, measured overflow for the hover loop. */
export function OverflowMarquee({
  text,
  className = '',
  trackClassName = '',
}: {
  text: string
  className?: string
  trackClassName?: string
}) {
  const viewport = useRef<HTMLSpanElement>(null)
  const track = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const host = viewport.current
    const content = track.current
    if (!host || !content) return
    let disposed = false
    const measure = () => {
      if (disposed) return
      const distance =
        host.clientWidth > 0
          ? Math.max(0, content.scrollWidth - host.clientWidth)
          : 0
      host.setAttribute('data-overflow', String(distance > 1))
      host.style.setProperty('--marquee-distance', `${distance}px`)
      // Travel occupies 68% of the loop; the rest holds either end and snaps back.
      host.style.setProperty(
        '--marquee-duration',
        `${Math.max(4000, Math.round((distance / 32 / 0.68) * 1000))}ms`,
      )
    }
    measure()
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(host)
    observer?.observe(content)
    window.addEventListener('resize', measure)
    void document.fonts?.ready.then(measure)
    return () => {
      disposed = true
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [text])
  return (
    <span
      className={`overflow-marquee ${className}`}
      ref={viewport}
      title={text}
    >
      <span className={`overflow-marquee-track ${trackClassName}`} ref={track}>
        {text}
      </span>
    </span>
  )
}
