import { useLayoutEffect } from 'react'
import type { RefObject } from 'react'

/** Measure in the track's own coordinates so rapid inputs retarget an in-flight transition. */
export function useSingleLineFlow(
  host: RefObject<HTMLElement | null>,
  revision: string,
  reset: boolean,
  consume: boolean,
  cursorSelector: string,
) {
  useLayoutEffect(() => {
    const viewport = host.current
    if (!viewport) return
    const track = viewport.querySelector<HTMLElement>('.flow-track')
    if (!track) return
    let frame = 0
    const reveal = () => {
      const cursor = track.querySelector<HTMLElement>(
        consume ? '[data-word-anchor]' : cursorSelector,
      )
      const offset = cursor
        ? cursor.getBoundingClientRect().left -
          track.getBoundingClientRect().left
        : 0
      const x = reset
        ? 0
        : Math.max(0, offset - (consume ? 4 : viewport.clientWidth * 0.24))
      if (reset) {
        track.style.setProperty('transition', 'none')
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(() => {
          track.style.removeProperty('transition')
        })
      }
      track.style.setProperty('transform', `translateX(${-x}px)`)
      viewport.scrollTo({ left: 0, top: 0, behavior: 'instant' })
    }
    reveal()
    const observer = new ResizeObserver(reveal)
    observer.observe(viewport)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      track.style.removeProperty('transition')
    }
  }, [host, revision, reset, consume, cursorSelector])
}
