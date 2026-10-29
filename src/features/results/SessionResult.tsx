import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { RecordEntry } from '../../domain/records/types'
import {
  recordGroup,
  recordPoint,
  recordTitle,
  recordMissLabel,
  chronological,
} from '../../domain/records/recordStats'
import { resultAnalysis } from '../../domain/records/results'
import { RecordDetails } from '../history/HistoryInsights'
const seconds = (ms: number) => `${(ms / 1000).toFixed(2)}秒`
const keyLabel = (key: string) =>
  key === ' '
    ? 'Space'
    : key === '\u3099'
      ? '゛'
      : key === '\u309a'
        ? '゜'
        : key
export function SessionResult({
  record,
  history = [],
  heading = 'SESSION COMPLETE',
  message,
  actions,
  variant = 'neutral',
}: {
  record: RecordEntry
  history?: RecordEntry[]
  heading?: string
  message?: string
  actions?: ReactNode
  variant?: 'neutral' | 'win' | 'loss'
}) {
  const host = useRef<HTMLElement>(null)
  const [details, setDetails] = useState(false)
  const analysis = useMemo(
    () => (record.trace ? resultAnalysis(record.trace) : null),
    [record.trace],
  )
  const past = chronological([
    ...new Map(
      history
        .filter(
          (r) => r.id !== record.id && recordGroup(r) === recordGroup(record),
        )
        .map((r) => [r.id, r]),
    ).values(),
  ])
  const best = past.length ? Math.max(...past.map(recordPoint)) : null
  const max = Math.max(1, ...(analysis?.buckets.map((b) => b.kpm) ?? []))
  useEffect(() => {
    host.current?.focus({ preventScroll: true })
    host.current?.closest('.mission-face')?.scrollTo(0, 0)
  }, [])
  return (
    <section
      className={`session-result result-${variant}`}
      tabIndex={-1}
      ref={host}
      aria-label="セッションの結果"
    >
      <div className="result-heading">
        <span className="eyebrow">FLIGHT REPORT</span>
        <h2>{heading}</h2>
        <p>
          {record.title} · {record.layout}
          {record.seed ? ` · シード ${record.seed}` : ''}
        </p>
        {message && <p role="status">{message}</p>}
      </div>
      <div className="result-score">
        <strong>
          {recordPoint(record)} <small>pt</small>
        </strong>
        <span>{recordTitle(record)}</span>
      </div>
      <div className="result-metrics">
        <div>
          <span>打鍵速度</span>
          <strong>
            {record.kpm} <small>KPM</small>
          </strong>
        </div>
        <div>
          <span>計測時間</span>
          <strong>{seconds(record.elapsed)}</strong>
        </div>
        <div>
          <span>正確率</span>
          <strong>{Number(record.accuracy.toFixed(2))}%</strong>
        </div>
        <div>
          <span>正打鍵 / 実ミス</span>
          <strong>
            {record.actualKeys ?? record.keys} /{' '}
            {record.rawMisses ?? record.misses}
          </strong>
        </div>
      </div>
      <p className="small muted">
        {recordMissLabel(record)}
        {record.strokeLimit
          ? ` · 基準 ${record.keys}打 / 実打 ${record.actualKeys ?? record.keys}打`
          : ''}{' '}
        · 休止時間を除く
      </p>
      {past.length > 0 && (
        <div className="result-comparison">
          <span>過去最高 {best} pt</span>
          <span>前回 {recordPoint(past[0])} pt</span>
          <strong>
            {recordPoint(record) >= best!
              ? '自己ベストに到達'
              : `最高まで ${best! - recordPoint(record)} pt`}
          </strong>
        </div>
      )}
      <div className="result-actions">
        {actions}
        <button className="text-button" onClick={() => setDetails((v) => !v)}>
          {details ? '打鍵詳細を閉じる' : '全打鍵・リプレイを確認'}
        </button>
      </div>
      {analysis && (
        <>
          <h3>速度とミスの推移</h3>
          <svg
            className="result-pace"
            viewBox="0 0 640 135"
            role="img"
            aria-label="1秒ごとのKPMとミス"
          >
            <text x="8" y="14">
              最大 {max.toFixed(0)} KPM
            </text>
            <polyline
              points={analysis.buckets
                .map(
                  (b, i, a) =>
                    `${20 + (i * 600) / Math.max(1, a.length - 1)},${115 - (b.kpm / max) * 90}`,
                )
                .join(' ')}
            />
            {analysis.buckets.map(
              (b, i, a) =>
                b.misses > 0 && (
                  <circle
                    key={i}
                    cx={20 + (i * 600) / Math.max(1, a.length - 1)}
                    cy={115 - (b.kpm / max) * 90}
                    r={Math.min(8, 3 + b.misses)}
                  >
                    <title>
                      {b.time}秒: {b.misses}ミス / {b.kpm.toFixed(1)}KPM
                    </title>
                  </circle>
                ),
            )}
            <text x="10" y="132">
              0秒
            </text>
            <text x="540" y="132">
              {seconds(record.elapsed)}
            </text>
          </svg>
          <h3>
            間違えた箇所 <small>{analysis.mistakes.length}種類</small>
          </h3>
          {analysis.mistakes.length ? (
            <div className="result-table-scroll">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>箇所</th>
                    <th>正解キー</th>
                    <th>誤入力</th>
                    <th>回数</th>
                    <th>初回時刻</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.mistakes.slice(0, 30).map((m, i) => (
                    <tr key={i}>
                      <td title={record.trace!.prompts[m.prompt].text}>
                        問題{m.prompt + 1} · {m.character}
                      </td>
                      <td>{keyLabel(m.expected)}</td>
                      <td className="result-error">{keyLabel(m.key)}</td>
                      <td>{m.count}</td>
                      <td>{seconds(m.first)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="result-perfect">NO MISS · ミスなし</p>
          )}
          {analysis.mistakes.length > 30 && (
            <p className="small muted">
              ミス数の多い30箇所を表示。全件は打鍵詳細で確認できます。
            </p>
          )}
          <h3>時間がかかった文章</h3>
          <ol className="result-losses">
            {[...analysis.prompts]
              .sort((a, b) => b.loss - a.loss)
              .slice(0, 5)
              .map((p) => (
                <li key={p.index}>
                  <p>
                    問題{p.index + 1} · {p.text}
                  </p>
                  <small>
                    {seconds(p.end - p.start)} · {p.kpm.toFixed(1)} KPM · 実ミス{' '}
                    {p.misses} · ロス目安 {seconds(p.loss)}
                  </small>
                </li>
              ))}
          </ol>
          <p className="small muted">
            ロスは正打鍵間隔の中央値を超えた待ち時間の目安です。グラフは正しい実打鍵数のKPMで、タイプウェルの基準打鍵KPMとは区別します。
          </p>
        </>
      )}
      {details && (
        <RecordDetails record={record} onClose={() => setDetails(false)} />
      )}
    </section>
  )
}
