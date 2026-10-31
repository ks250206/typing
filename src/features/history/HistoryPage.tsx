import { PageHeading } from '../../shared/ui/PageHeading'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useScrollTransition } from '../../shared/ui/useScrollTransition'
import { Pagination } from '../../shared/ui/Pagination'
import { usePagination } from '../../shared/ui/usePagination'
import { chronological, recordGroup } from '../../domain/records/recordStats'
import {
  ArrowDownToLine,
  ArrowRight,
  History,
  Trash2,
  ChartNoAxesCombined,
  ListOrdered,
} from 'lucide-react'
import { isConstitutionArticles } from '../../domain/content/constitutionArticles'
import { isEtyping } from '../../domain/content/etyping'
import { isRtc } from '../../domain/content/rtcWords'
import { isTrainer } from '../../domain/content/sakusaku'
import { isTypewell } from '../../domain/content/typewell'
import {
  recordMissLabel,
  recordPoint,
  recordTitle,
} from '../../domain/records/recordStats'
import type { RecordEntry } from '../../domain/records/types'
import { layoutLabels } from '../../domain/typing/engine'
import { time } from '../../shared/formatTime'
import { HistoryInsights, RecordDetails } from './HistoryInsights'
import type { HistoryController } from './useHistory'

export function HistoryPage({
  history,
  onGhost,
  onCpuReplay,
  onPracticeReplay,
  onPractice,
}: {
  history: HistoryController
  onGhost: (record: RecordEntry) => void
  onCpuReplay: (record: RecordEntry) => void
  onPracticeReplay: (record: RecordEntry) => void
  onPractice: () => void
}) {
  const {
    records,
    bestRecords,
    detail,
    detailReplay,
    exportRecords,
    selectDetail,
    closeDetail,
  } = history
  const all = useMemo(
    () =>
      chronological([
        ...new Map(
          [...bestRecords, ...records]
            .filter((r) => r.mode !== 'weak')
            .map((r) => [r.id, r]),
        ).values(),
      ]),
    [bestRecords, records],
  )
  const scrollTo = useScrollTransition()
  const [view, setView] = useState<'analysis' | 'records'>('analysis')
  const [selection, setSelection] = useState('')
  const selected = all.some((r) => recordGroup(r) === selection)
    ? selection
    : all[0]
      ? recordGroup(all[0])
      : ''
  const paging = usePagination(all.length)
  const detailAnchor = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const target = detailAnchor.current
    const container = target?.closest<HTMLElement>('.history-panel')
    if (detail && target && container) scrollTo(container, target)
  }, [detail, detailReplay, scrollTo])
  const detailView = detail && (
    <div ref={detailAnchor}>
      <RecordDetails
        key={`${detail.id}/${detailReplay}`}
        initialView={detailReplay ? 'replay' : 'trend'}
        history={all}
        record={detail}
        onGhost={(record) => {
          onGhost(record)
        }}
        onClose={() => closeDetail()}
      />
    </div>
  )
  return (
    <section className="history-workspace">
      <PageHeading
        eyebrow="PRACTICE RECORDS"
        title="練習の記録"
        actions={
          <>
            <button className="text-button" onClick={exportRecords}>
              <ArrowDownToLine size={14} />
              JSON 書出し
            </button>
            <button
              className="icon-button"
              aria-label="全記録を削除"
              onClick={history.requestClear}
            >
              <Trash2 size={15} />
            </button>
          </>
        }
      >
        <p className="history-count">完了した挑戦 {all.length} 回</p>
      </PageHeading>
      {all.length > 0 ? (
        <div className="history-carousel">
          <div className="history-views" role="tablist" aria-label="記録の表示">
            {(
              [
                ['analysis', '文章別の記録分析'],
                ['records', '全記録'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                id={`history-tab-${id}`}
                aria-controls={`history-panel-${id}`}
                aria-selected={view === id}
                onKeyDown={(e) => {
                  if (
                    !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)
                  )
                    return
                  e.preventDefault()
                  const buttons =
                    e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                      '[role="tab"]',
                    )
                  const next =
                    e.key === 'Home'
                      ? 0
                      : e.key === 'End'
                        ? 1
                        : id === 'analysis'
                          ? 1
                          : 0
                  buttons?.[next]?.focus()
                  buttons?.[next]?.click()
                }}
                onClick={() => {
                  setView(id)
                  closeDetail()
                }}
              >
                <small aria-hidden="true">
                  {id === 'analysis' ? '01' : '02'}
                </small>
                {id === 'analysis' ? (
                  <ChartNoAxesCombined size={18} aria-hidden="true" />
                ) : (
                  <ListOrdered size={18} aria-hidden="true" />
                )}
                <span>{label}</span>
                <i aria-hidden="true" />
              </button>
            ))}
          </div>
          <div
            className="history-viewport"
            data-direction={view === 'records' ? 'next' : 'previous'}
          >
            {view === 'analysis' ? (
              <section
                key="analysis"
                className="history-panel"
                role="tabpanel"
                id="history-panel-analysis"
                aria-labelledby="history-tab-analysis"
              >
                {detailView}
                <div>
                  <HistoryInsights
                    records={all}
                    bests={bestRecords}
                    selection={selected}
                    selectedId={detail?.id}
                    onGroupChange={(key) => {
                      setSelection(key)
                      closeDetail()
                    }}
                    onSelect={selectDetail}
                  />
                </div>
              </section>
            ) : (
              <section
                key="records"
                className="history-panel"
                role="tabpanel"
                id="history-panel-records"
                aria-labelledby="history-tab-records"
              >
                {detailView}
                <div className="history-table">
                  <table>
                    <thead>
                      <tr>
                        <th>文章 / 日時</th>
                        <th>入力方式</th>
                        <th>point / 称号</th>
                        <th>KPM</th>
                        <th>正確率</th>
                        <th>時間</th>
                      </tr>
                    </thead>
                    <tbody>
                      {all
                        .slice(paging.start, paging.start + paging.size)
                        .map((r) => (
                          <tr key={r.id}>
                            <td>
                              <strong className="history-record-title">
                                {r.title}
                              </strong>
                              <small>
                                {new Date(r.date).toLocaleString('ja-JP')}
                              </small>
                              <div className="history-record-actions">
                                <button
                                  className="text-button"
                                  onClick={() => {
                                    selectDetail(r)
                                  }}
                                >
                                  詳細を見る
                                </button>
                                {(r.hasTrace || r.trace) && (
                                  <button
                                    className="text-button"
                                    onClick={() => {
                                      selectDetail(r, true)
                                    }}
                                  >
                                    リプレイを見る
                                  </button>
                                )}
                                {(r.hasTrace || r.trace) && (
                                  <button
                                    className="text-button"
                                    onClick={() => {
                                      onGhost(r)
                                    }}
                                  >
                                    ゴーストと対戦
                                  </button>
                                )}
                                {r.mode === 'cpu' && r.seed && (
                                  <button
                                    className="text-button"
                                    onClick={() => {
                                      onCpuReplay(r)
                                    }}
                                  >
                                    対戦シード {r.seed} を再現
                                  </button>
                                )}
                                {r.seed &&
                                  r.mode !== 'cpu' &&
                                  r.mode !== 'ghost' &&
                                  (isTypewell(r.passageId) ||
                                    isEtyping(r.passageId) ||
                                    isTrainer(r.passageId) ||
                                    isConstitutionArticles(r.passageId) ||
                                    isRtc(r.passageId)) && (
                                    <button
                                      className="text-button"
                                      onClick={() => {
                                        onPracticeReplay(r)
                                      }}
                                    >
                                      シード {r.seed} を再現
                                    </button>
                                  )}
                              </div>
                            </td>
                            <td>{layoutLabels[r.layout]}</td>
                            <td className="record-point">
                              {recordPoint(r)} pt
                              <small>
                                {recordTitle(r)}
                                {r.scoreVersion !== 3 ? ' · 旧ミス方式' : ''}
                                <span className="record-miss-label">
                                  {recordMissLabel(r)}
                                </span>
                              </small>
                            </td>
                            <td className="record-kpm">{r.kpm}</td>
                            <td>{r.accuracy}%</td>
                            <td>{time(r.elapsed)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  total={all.length}
                  page={paging.page}
                  size={paging.size}
                  onPage={paging.setPage}
                  label="全記録のページ送り"
                />
                <p className="small muted">
                  保存されている全記録を新しい順で表示。キャンセル・中断は含みません。以前の200件制限で削除された記録は復元できません。残るTOP記録は重複を除いて含めます。
                </p>
              </section>
            )}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <History size={32} />
          <h3>最初の一篇から、はじめよう。</h3>
          <p>最後まで打ち終えると、ここに記録が残ります。</p>
          <button className="primary-button" onClick={() => onPractice()}>
            タイピングへ
            <ArrowRight size={15} />
          </button>
        </div>
      )}
    </section>
  )
}
