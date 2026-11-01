import { useEffect } from 'react'
import type { Sentence } from '../../domain/content/sentences'
import {
  sentenceStatsKey,
  type SentenceStats,
} from '../../domain/records/sentencePractice'
import type { Layout } from '../../domain/typing/engine'
import { sentenceKeyCount } from '../../domain/typing/sentenceEngine'
import { OverflowMarquee } from '../../shared/ui/OverflowMarquee'
import { Pagination } from '../../shared/ui/Pagination'
import { usePagination } from '../../shared/ui/usePagination'

export function SentenceWordTable({
  pool,
  passageId,
  title,
  layout,
  selected,
  stats,
  onSelect,
}: {
  pool: Sentence[]
  passageId: string
  title: string
  layout: Layout
  selected: number
  stats: SentenceStats
  onSelect: (index: number) => void
}) {
  const { page, size, start, setPage } = usePagination(pool.length, 10)
  useEffect(() => {
    setPage(Math.floor(selected / size))
  }, [selected, size, setPage])
  return (
    <section
      className="sentence-word-list"
      aria-label="文章別の練習統計"
      data-game-shortcuts="off"
    >
      <div className="sentence-list-heading">
        <h3>{title}</h3>
        <span>文章を選んで練習 · {pool.length}件</span>
      </div>
      <div className="sentence-table-scroll">
        <table className="sentence-word-table">
          <colgroup>
            <col className="sentence-number" />
            {Array.from({ length: 5 }, (_, i) => (
              <col key={i} className="sentence-stat-column" />
            ))}
            <col />
          </colgroup>
          <thead>
            <tr>
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
            {pool.slice(start, start + size).map((sentence, offset) => {
              const index = start + offset
              const row = stats[sentenceStatsKey(passageId, layout, sentence)]
              return (
                <tr key={index} data-selected={selected === index || undefined}>
                  <td data-label="#">{index + 1}</td>
                  <td data-label="Best KPM">
                    {row ? row.best.toFixed(1) : '—'}
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
                      aria-label={`文章${index + 1}：${sentence.text}`}
                      aria-pressed={selected === index}
                      onClick={() => onSelect(index)}
                    >
                      <OverflowMarquee text={sentence.text} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Pagination
        total={pool.length}
        page={page}
        size={size}
        onPage={setPage}
        label="文章別統計のページ送り"
      />
    </section>
  )
}
