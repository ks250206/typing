import { useMemo } from 'react'
import type { RecordEntry } from '../../domain/records/types'
import { recordPoint } from '../../domain/records/recordStats'
import { insightPace } from '../../domain/records/insightMetrics'
import { Pagination } from '../../shared/ui/Pagination'
import { usePagination } from '../../shared/ui/usePagination'
import { usePaceRecords } from './usePaceRecords'

export function PassageRecords({
  records,
  selectedId,
  onSelect,
}: {
  records: RecordEntry[]
  selectedId?: string
  onSelect: (record: RecordEntry) => void
}) {
  const paging = usePagination(records.length)
  const visible = useMemo(
    () => records.slice(paging.start, paging.start + paging.size),
    [records, paging.start, paging.size],
  )
  const rows = usePaceRecords(visible)
  const speed = (v: number | undefined) =>
    v === undefined
      ? '—'
      : `${Number(v.toFixed(2)).toLocaleString('ja-JP')} KPM`
  return (
    <section className="passage-records" aria-label="過去の記録一覧">
      <h3>
        過去の記録一覧 <small>{records.length}回の完了した挑戦</small>
      </h3>
      <p className="small muted">
        選択中の文章・配列・モードの記録を新しい順に表示します。行をクリック、またはEnter／Spaceで詳細へ移動。最高・最低速度は5秒移動平均です。
      </p>
      <div className="history-table">
        <table>
          <thead>
            <tr>
              <th>挑戦日時</th>
              <th>point</th>
              <th>KPM</th>
              <th>
                最高速度
                <br />
                5秒平均
              </th>
              <th>
                最低速度
                <br />
                5秒平均
              </th>
              <th>正確率</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const moving = insightPace(r)
              const date = new Date(r.date).toLocaleString('ja-JP')
              return (
                <tr
                  key={r.id}
                  tabIndex={0}
                  aria-label={`${date}の記録詳細`}
                  data-selected={selectedId === r.id}
                  onClick={() => onSelect(r)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(r)
                    }
                  }}
                >
                  <td>
                    <time dateTime={r.date}>{date}</time>
                    {r.seed && <small>シード {r.seed}</small>}
                  </td>
                  <td>{recordPoint(r)} pt</td>
                  <td>{r.kpm}</td>
                  <td>{speed(moving?.max)}</td>
                  <td>{speed(moving?.min)}</td>
                  <td>{r.accuracy}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Pagination
        total={records.length}
        page={paging.page}
        size={paging.size}
        onPage={paging.setPage}
        label="過去の記録のページ送り"
      />
    </section>
  )
}
