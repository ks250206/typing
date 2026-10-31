import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { favoriteKey, type Favorite } from '../../domain/records/favorites'

/** Preview locally while dragging; commit the complete order only on drop. */
export function useFavoriteOrder(
  items: Favorite[],
  onReorder: (order: string[]) => void,
) {
  const host = useRef<HTMLElement>(null)
  const drag = useRef<{
    pointerId: number
    key: string
    keys: string[]
    startY: number
    moved: boolean
  } | null>(null)
  const [preview, setPreview] = useState<string[] | null>(null)
  const [draggingKey, setDraggingKey] = useState<string | undefined>(undefined)
  const [announcement, setAnnouncement] = useState('')
  const previousPositions = useRef(new Map<string, number>())
  const animations = useRef(new Map<string, Animation>())
  const keys = items.map(favoriteKey)
  const byKey = new Map(items.map((item) => [favoriteKey(item), item]))
  const order =
    preview?.length === items.length && preview.every((key) => byKey.has(key))
      ? preview
      : keys
  const capturePositions = () => {
    previousPositions.current = new Map(
      [
        ...(host.current?.querySelectorAll<HTMLElement>(
          'li[data-favorite-key]',
        ) ?? []),
      ].map((row) => [
        row.dataset.favoriteKey!,
        row.getBoundingClientRect().top,
      ]),
    )
    animations.current.forEach((animation) => animation.cancel())
    animations.current.clear()
  }
  useLayoutEffect(() => {
    const previous = previousPositions.current
    if (!previous.size) return
    previousPositions.current = new Map()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    host.current
      ?.querySelectorAll<HTMLElement>('li[data-favorite-key]')
      .forEach((row) => {
        const key = row.dataset.favoriteKey!
        const top = previous.get(key)
        const offset =
          top === undefined ? 0 : top - row.getBoundingClientRect().top
        if (Math.abs(offset) < 1 || typeof row.animate !== 'function') return
        const animation = row.animate(
          [
            { transform: `translateY(${offset}px)` },
            { transform: 'translateY(0)' },
          ],
          { duration: 180, easing: 'cubic-bezier(0.2, 0, 0.2, 1)' },
        )
        animations.current.set(key, animation)
        animation.onfinish = () => {
          if (animations.current.get(key) === animation)
            animations.current.delete(key)
        }
      })
  }, [order])
  useEffect(
    () => () => {
      animations.current.forEach((animation) => animation.cancel())
      animations.current.clear()
    },
    [],
  )
  useEffect(() => {
    // A storage update from another tab cancels a stale drag instead of losing entries.
    if (drag.current) {
      drag.current = null
      setPreview(null)
      setDraggingKey(undefined)
    }
  }, [items])
  const cancel = () => {
    const pointerId = drag.current?.pointerId
    if (pointerId === undefined) return false
    capturePositions()
    drag.current = null
    setPreview(null)
    setDraggingKey(undefined)
    if (host.current?.hasPointerCapture(pointerId))
      host.current.releasePointerCapture(pointerId)
    return true
  }
  return {
    host,
    announcement,
    displayItems: order.map((key) => byKey.get(key)!),
    draggingKey,
    cancel,
    start: (event: PointerEvent<HTMLButtonElement>, key: string) => {
      if (event.button !== 0 || items.length < 2) return
      event.preventDefault()
      host.current?.focus({ preventScroll: true })
      drag.current = {
        pointerId: event.pointerId,
        key,
        keys: [...keys],
        startY: event.clientY,
        moved: false,
      }
      setPreview([...keys])
      setDraggingKey(key)
      // Capture on the stable host, not a row that moves in the DOM.
      host.current?.setPointerCapture(event.pointerId)
    },
    move: (event: PointerEvent<HTMLElement>) => {
      const current = drag.current
      if (!current || current.pointerId !== event.pointerId || !host.current)
        return
      if (!current.moved && Math.abs(event.clientY - current.startY) < 4) return
      current.moved = true
      const panel = host.current.querySelector<HTMLElement>('.favorites-panel')!
      const scroller =
        panel.scrollHeight > panel.clientHeight ? panel : host.current
      const bounds = scroller.getBoundingClientRect()
      if (event.clientY < bounds.top + 24) scroller.scrollBy(0, -12)
      else if (event.clientY > bounds.bottom - 24) scroller.scrollBy(0, 12)
      const rows = [
        ...host.current.querySelectorAll<HTMLElement>('li[data-favorite-key]'),
      ]
      const listTop = host.current
        .querySelector('ul')!
        .getBoundingClientRect().top
      // Hit-test layout positions, independently of the current FLIP transform.
      const target = rows.findIndex(
        (row) => event.clientY < listTop + row.offsetTop + row.offsetHeight,
      )
      const to = target < 0 ? rows.length - 1 : target
      const from = current.keys.indexOf(current.key)
      if (from < 0 || to < 0 || from === to) return
      const next = [...current.keys]
      next.splice(to, 0, next.splice(from, 1)[0])
      capturePositions()
      current.keys = next
      setPreview(next)
    },
    finish: (event: PointerEvent<HTMLElement>) => {
      const current = drag.current
      if (!current || current.pointerId !== event.pointerId) return
      if (current.moved) {
        onReorder([...current.keys])
        setAnnouncement(
          `お気に入りを${current.keys.indexOf(current.key) + 1}番目に移動しました`,
        )
      }
      cancel()
    },
    moveByKey: (event: KeyboardEvent<HTMLButtonElement>, key: string) => {
      const from = keys.indexOf(key)
      const to =
        event.key === 'ArrowUp'
          ? from - 1
          : event.key === 'ArrowDown'
            ? from + 1
            : event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? keys.length - 1
                : -1
      if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      event.stopPropagation()
      if (from < 0 || to < 0 || to >= keys.length || from === to) return
      const next = [...keys]
      next.splice(to, 0, next.splice(from, 1)[0])
      capturePositions()
      onReorder(next)
      setAnnouncement(`お気に入りを${to + 1}番目に移動しました`)
    },
  }
}
