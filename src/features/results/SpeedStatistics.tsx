import { useEffect, useMemo, useState } from 'react'
import type { RecordEntry } from '../../domain/records/types'
import {
  intervalStatistics,
  paceRanks,
  summarizePace,
  PACE_WINDOW,
} from '../../domain/records/pace'
import { recordGroup } from '../../domain/records/recordStats'
import { readTraces } from '../../infrastructure/persistence/traceStore'

export function SpeedStatistics({
  record,
  history,
}: {
  record: RecordEntry
  history: RecordEntry[]
}) {
  const [older, setOlder] = useState<RecordEntry[]>([])
  const group = recordGroup(record)
  useEffect(() => {
    let active = true
    const missing = history.filter(
      (r) =>
        (!r.pace || (r.pace.samples >= PACE_WINDOW && !r.pace.moving)) &&
        !r.trace &&
        r.hasTrace &&
        recordGroup(r) === group,
    )
    void readTraces(missing.map((r) => r.id)).then((traces) => {
      if (active)
        setOlder(
          missing.flatMap((r) =>
            traces[r.id] ? [{ ...r, trace: traces[r.id] }] : [],
          ),
        )
    })
    return () => {
      active = false
    }
  }, [history, group])
  const summary = useMemo(
    () => (record.trace ? summarizePace(record.trace) : record.pace),
    [record.trace, record.pace],
  )
  const intervals = useMemo(
    () => (record.trace ? intervalStatistics(record.trace) : null),
    [record.trace],
  )
  const ranks = paceRanks(record, [...history, ...older], summary)
  if (!summary)
    return (
      <p className="small muted">
        速度統計は1秒以上の打鍵ログがある記録で表示します。
      </p>
    )
  const unavailable =
    summary.samples < PACE_WINDOW
      ? `${PACE_WINDOW}秒以上の計測で順位を表示`
      : '移動平均の算出には打鍵ログが必要です'
  const n = (v: number) => Number(v.toFixed(2)).toLocaleString('ja-JP')
  return (
    <section className="speed-statistics" aria-label="速度の詳細統計">
      <h3>速度の詳細統計</h3>
      <dl className="statistics-grid">
        <div className="moving-stat">
          <dt>{PACE_WINDOW}秒移動平均の最低速度</dt>
          <dd>{summary.moving ? `${n(summary.moving.min)} KPM` : '—'}</dd>
          <small>
            {ranks
              ? `過去順位 ${ranks.min} / ${ranks.count}（高いほど上位）`
              : unavailable}
          </small>
        </div>
        <div className="moving-stat">
          <dt>{PACE_WINDOW}秒移動平均の最高速度</dt>
          <dd>{summary.moving ? `${n(summary.moving.max)} KPM` : '—'}</dd>
          <small>
            {ranks ? `過去順位 ${ranks.max} / ${ranks.count}` : unavailable}
          </small>
        </div>
        <div>
          <dt>最低速度</dt>
          <dd>{n(summary.min)} KPM</dd>
        </div>
        <div>
          <dt>最高速度</dt>
          <dd>{n(summary.max)} KPM</dd>
        </div>
        <div>
          <dt>区間平均</dt>
          <dd>{n(summary.mean)} KPM</dd>
        </div>
        <div>
          <dt>中央値</dt>
          <dd>{n(summary.median)} KPM</dd>
        </div>
        <div>
          <dt>分散（母分散）</dt>
          <dd>{n(summary.variance)} KPM²</dd>
        </div>
        <div>
          <dt>標準偏差</dt>
          <dd>{n(summary.sd)} KPM</dd>
        </div>
        <div>
          <dt>変動係数</dt>
          <dd>
            {summary.mean ? `${n((summary.sd / summary.mean) * 100)}%` : '—'}
          </dd>
        </div>
        <div>
          <dt>90パーセンタイル</dt>
          <dd>{n(summary.p90)} KPM</dd>
        </div>
        {intervals && (
          <>
            <div>
              <dt>平均打鍵間隔</dt>
              <dd>{intervals.max ? `${n(intervals.mean)} ms` : '—'}</dd>
            </div>
            <div>
              <dt>打鍵間隔の中央値</dt>
              <dd>{intervals.max ? `${n(intervals.median)} ms` : '—'}</dd>
            </div>
            <div>
              <dt>最大打鍵間隔</dt>
              <dd>{intervals.max ? `${n(intervals.max)} ms` : '—'}</dd>
            </div>
            <div>
              <dt>最長連続ミス</dt>
              <dd>{intervals.longestMissStreak} 打</dd>
            </div>
          </>
        )}
      </dl>
      <p className="small muted">
        完全な1秒区間 {summary.samples}
        個の正しい実打鍵KPMで計算。無入力区間は0、末尾の1秒未満は除外します。移動平均は完全な5秒区間を1秒ずつ送って計算し、過去順位はその最低・最高値のみで比較します。5秒未満は順位の対象外です。順位は同じ文章セット・配列・モード・出題方式の、移動平均の要約または再計算できるログが残る保存記録と今回を比較（同率は同順位）。最低速度も高いほど上位です。休止時間を除き、打鍵間隔の統計は0msを除外します。平均速度0の変動係数や、打鍵間隔の標本がない項目は—で表示します。
      </p>
    </section>
  )
}
