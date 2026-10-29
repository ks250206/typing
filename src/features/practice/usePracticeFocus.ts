import { useEffect, useRef } from 'react'

export function usePracticeFocus() {
  const area = useRef<HTMLDivElement>(null)
  const focusRevision = useRef(0)
  const focus = () => {
    const revision = ++focusRevision.current
    const previous = document.activeElement
    requestAnimationFrame(() => {
      const el = area.current
      if (!el || el.closest('[inert]')) return
      const animations = el.closest('.mission-face')?.getAnimations() ?? []
      void Promise.allSettled(
        animations.map((animation) => animation.finished),
      ).then(() => {
        if (
          !el.isConnected ||
          revision !== focusRevision.current ||
          el.closest('[inert]')
        )
          return
        if (
          document.activeElement !== previous &&
          document.activeElement !== document.body &&
          document.activeElement !== el
        )
          return
        el.focus()
      })
    })
  }
  useEffect(
    () => () => {
      focusRevision.current++
    },
    [],
  )
  return { area, focus }
}
