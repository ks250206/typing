import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { Sentence } from '../../domain/content/sentences'
import {
  sentenceStatsKey,
  type SentenceStats,
} from '../../domain/records/sentencePractice'
import type { Layout } from '../../domain/typing/engine'
import { sentenceKeyCount } from '../../domain/typing/sentenceEngine'
import { OverflowMarquee } from '../../shared/ui/OverflowMarquee'

const overscan = 4
export function SentenceWordTable({
  pool,
  passageId,
  layout,
  selected,
  stats,
  onSelect,
}: {
  pool: Sentence[]
  passageId: string
  layout: Layout
  selected: number
  stats: SentenceStats
  onSelect: (index: number) => void
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const header = useRef<HTMLTableSectionElement>(null)
  const pendingFocus = useRef<number | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [rowHeight, setRowHeight] = useState(() =>
    window.matchMedia('(max-width: 800px)').matches ? 78 : 38,
  )
  const [headerHeight, setHeaderHeight] = useState(32)
  const [focusIndex, setFocusIndex] = useState(selected)
  const [jump, setJump] = useState(String(selected + 1))
  const height = Math.min(340, headerHeight + pool.length * rowHeight)
  const firstVisible = Math.max(
    0,
    Math.floor((scrollTop - headerHeight) / rowHeight),
  )
  const start = Math.max(0, firstVisible - overscan)
  const end = Math.min(
    pool.length,
    Math.ceil((scrollTop + height - headerHeight) / rowHeight) + overscan,
  )
  useLayoutEffect(() => {
    const host = viewport.current
    if (!host) return
    const measure = () => {
      setRowHeight(
        parseFloat(
          getComputedStyle(host).getPropertyValue('--sentence-row-height'),
        ) || 38,
      )
      const head = header.current
      setHeaderHeight(
        head && getComputedStyle(head).position !== 'absolute'
          ? head.offsetHeight
          : 0,
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])
  const scrollToIndex = (index: number, align: 'start' | 'auto' = 'auto') => {
    const host = viewport.current
    if (!host) return
    const top = headerHeight + index * rowHeight
    if (align === 'start' || top < host.scrollTop + headerHeight)
      host.scrollTop = index * rowHeight
    else if (top + rowHeight > host.scrollTop + host.clientHeight)
      host.scrollTop = top + rowHeight - host.clientHeight
    setScrollTop(host.scrollTop)
  }
  useLayoutEffect(() => {
    setFocusIndex(selected)
    setJump(String(selected + 1))
    scrollToIndex(selected)
    // Selection follows the active sentence, while wheel scrolling stays independent.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, rowHeight, headerHeight])
  useLayoutEffect(() => {
    if (pendingFocus.current === null) return
    const button = viewport.current?.querySelector<HTMLButtonElement>(
      `button[data-word-index="${pendingFocus.current}"]`,
    )
    if (button) {
      button.focus({ preventScroll: true })
      pendingFocus.current = null
    }
  }, [start, end, focusIndex])
  const focusRow = (index: number, align: 'start' | 'auto' = 'auto') => {
    const next = Math.max(0, Math.min(pool.length - 1, index))
    pendingFocus.current = next
    setFocusIndex(next)
    setJump(String(next + 1))
    scrollToIndex(next, align)
    const button = viewport.current?.querySelector<HTMLButtonElement>(
      `button[data-word-index="${next}"]`,
    )
    if (button) {
      button.focus({ preventScroll: true })
      pendingFocus.current = null
    }
  }
  const navigate = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const page = Math.max(1, Math.floor((height - headerHeight) / rowHeight))
    const target = {
      ArrowDown: index + 1,
      ArrowUp: index - 1,
      PageDown: index + page,
      PageUp: index - page,
      Home: 0,
      End: pool.length - 1,
    }[event.key]
    if (target === undefined) return
    event.preventDefault()
    focusRow(target)
  }
  const spacer = (size: number, key: string) =>
    size > 0 ? (
      <tr
        key={key}
        className="sentence-virtual-spacer"
        aria-hidden="true"
        style={{ height: size }}
      >
        <td colSpan={7} style={{ height: size }} />
      </tr>
    ) : null
  return (
    <section
      data-passage-id={passageId}
      className="sentence-word-list"
      aria-label="文章別の練習統計"
      data-game-shortcuts="off"
    >
      <div
        className="sentence-table-scroll"
        ref={viewport}
        style={{ height }}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <table
          className="sentence-word-table"
          data-virtual="true"
          aria-rowcount={pool.length + 1}
        >
          <colgroup>
            <col className="sentence-number" />
            {Array.from({ length: 5 }, (_, index) => (
              <col key={index} className="sentence-stat-column" />
            ))}
            <col />
          </colgroup>
          <thead ref={header}>
            <tr aria-rowindex={1}>
              <th scope="col">#</th>
              <th scope="col">Best KPM</th>
              <th scope="col">KPM</th>
              <th scope="col">秒</th>
              <th scope="col">試行</th>
              <th scope="col">打鍵</th>
              <th scope="col">文章 / ワード</th>
            </tr>
          </thead>
          <tbody>
            {spacer(start * rowHeight, 'before')}
            {pool.slice(start, end).map((sentence, offset) => {
              const index = start + offset
              const row = stats[sentenceStatsKey(passageId, layout, sentence)]
              return (
                <tr
                  key={index}
                  data-word-row={index}
                  aria-rowindex={index + 2}
                  data-selected={selected === index || undefined}
                >
                  <td data-label="#">{index + 1}</td>
                  <td data-label="Best KPM">
                    {row && row.best > 0 ? row.best.toFixed(1) : '—'}
                  </td>
                  <td data-label="KPM">{row ? row.kpm.toFixed(1) : '—'}</td>
                  <td data-label="秒">
                    {row ? (row.elapsed / 1000).toFixed(2) : '—'}
                  </td>
                  <td data-label="試行">{row?.tries ?? 0}</td>
                  <td data-label="打鍵">
                    {row?.keys ?? sentenceKeyCount(sentence, layout)}
                  </td>
                  <td>
                    <button
                      type="button"
                      data-word-index={index}
                      tabIndex={focusIndex === index ? 0 : -1}
                      aria-label={`文章${index + 1}：${sentence.text}`}
                      aria-pressed={selected === index}
                      onFocus={() => setFocusIndex(index)}
                      onKeyDown={(event) => navigate(event, index)}
                      onClick={() => onSelect(index)}
                    >
                      <OverflowMarquee text={sentence.text} />
                    </button>
                  </td>
                </tr>
              )
            })}
            {spacer((pool.length - end) * rowHeight, 'after')}
          </tbody>
        </table>
      </div>
      <form
        className="sentence-list-controls"
        noValidate
        aria-label="文章への移動"
        onSubmit={(event) => {
          event.preventDefault()
          const value = Number(jump)
          focusRow(
            Number.isFinite(value) ? Math.trunc(value) - 1 : selected,
            'start',
          )
        }}
      >
        <span>
          {firstVisible + 1}–
          {Math.min(
            pool.length,
            Math.ceil((scrollTop + height - headerHeight) / rowHeight),
          )}{' '}
          / {pool.length}
        </span>
        <button
          type="button"
          onClick={() => focusRow(0, 'start')}
          aria-label="最初の文章へ"
        >
          最初
        </button>
        <button
          type="button"
          onClick={() => focusRow(pool.length - 1, 'start')}
          aria-label="最後の文章へ"
        >
          最後
        </button>
        <label>
          番号{' '}
          <input
            type="number"
            aria-label="文章番号"
            min={1}
            max={pool.length}
            step={1}
            value={jump}
            onChange={(event) => setJump(event.target.value)}
          />
        </label>
        <button type="submit">ジャンプ</button>
      </form>
    </section>
  )
}
