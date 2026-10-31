import { ArrowDownToLine, ArrowRight, History, Trash2 } from 'lucide-react'
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
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>練習の記録</h2>
          <span className="muted">
            直近 {records.length} セッション / 最大 200 件
          </span>
        </div>
        <div>
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
        </div>
      </div>
      {records.length > 0 && (
        <HistoryInsights
          records={records}
          bests={bestRecords}
          onSelect={(r) => {
            selectDetail(r)
          }}
        />
      )}
      {detail && (
        <RecordDetails
          key={`${detail.id}/${detailReplay}`}
          initialView={detailReplay ? 'replay' : 'trend'}
          history={[...records, ...bestRecords]}
          record={detail}
          onGhost={(record) => {
            onGhost(record)
          }}
          onClose={() => closeDetail()}
        />
      )}
      {records.length ? (
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
              {records.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.title}
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
                    <small>{new Date(r.date).toLocaleString('ja-JP')}</small>
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
    </>
  )
}
