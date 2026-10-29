import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { RecordEntry } from '../../domain/records/types'
import {
  chronological,
  recordGroup,
  recordTrend,
  topRecords,
  modeOf,
  recordPoint,
  recordValue,
  recordTitle,
  recordMissLabel,
} from '../../domain/records/recordStats'
import type { RecordMetric } from '../../domain/records/recordStats'
import { Select } from '../../shared/ui/Select'
import { readTrace } from '../../infrastructure/persistence/traceStore'
import { analyzeTrace } from '../../domain/records/telemetry'
import type { SessionTrace } from '../../domain/records/telemetry'
const ReplayPlayer = lazy(() => import('./ReplayPlayer'))
const modes = {
  practice: '練習',
  trainer: '60秒',
  cpu: 'CPU対戦',
  ghost: 'ゴースト対戦',
}
const ms = (value: number) => `${(value / 1000).toFixed(2)}秒`

export function HistoryInsights({
  records,
  bests,
  onSelect,
}: {
  records: RecordEntry[]
  bests: RecordEntry[]
  onSelect: (r: RecordEntry) => void
}) {
  const all = useMemo(
    () => [...new Map([...bests, ...records].map((r) => [r.id, r])).values()],
    [records, bests],
  )
  const groups = useMemo(
    () => [...new Map(all.map((r) => [recordGroup(r), r])).entries()],
    [all],
  )
  const [selection, setSelection] = useState('')
  const [sameSeed, setSameSeed] = useState(false)
  const [metric, setMetric] = useState<RecordMetric>('point')
  const metricName = metric === 'point' ? 'point' : 'KPM'
  const unit = metric === 'point' ? 'pt' : 'KPM'
  const selected =
    groups.find(([key]) => key === selection) ??
    groups.find(([key]) => key === recordGroup(records[0])) ??
    groups[0]
  const group = selected?.[0]
  const latest = chronological(records.filter((r) => recordGroup(r) === group))
  const anchor = latest[0] ?? selected?.[1]
  const match = (r: RecordEntry) =>
    recordGroup(r) === group && (!sameSeed || r.seed === anchor?.seed)
  const recent = latest.filter(match)
  const trend = recordTrend(recent, metric)
  const top = topRecords(all.filter(match), metric)
  const points = trend.slice(-30)
  const maximum = Math.max(
    1,
    ...points.map((p) => Math.max(recordValue(p.record, metric), p.average)),
  )
  return (
    <section className="history-insights" aria-label="文章別の記録分析">
      <h3>文章別の記録分析</h3>
      <label>
        比較する文章・配列・モード
        <Select
          label="比較する記録"
          value={group ?? ''}
          onChange={setSelection}
          options={groups.map(([key, r]) => ({
            value: key,
            label: `${r.title} / ${r.layout} / ${modes[modeOf(r)]}${r.cpuConfig ? ` / CPU ${r.cpuConfig.kpm}KPM ${r.cpuConfig.reactionMs}ms ${r.cpuConfig.curve}` : ''}${r.replayVersion ? ` / v${r.replayVersion}` : ''}`,
          }))}
        />
      </label>
      <label className="inline-toggle">
        <input
          type="checkbox"
          checked={sameSeed}
          onChange={(e) => setSameSeed(e.target.checked)}
        />
        同じシードだけで比較
      </label>
      <div className="history-metrics">
        <div>
          <span>最新</span>
          <strong>
            {recent[0] ? recordPoint(recent[0]) : '—'} <small>pt</small>
          </strong>
          <small>
            {recent[0]
              ? `${recordTitle(recent[0])} · ${recent[0].kpm} KPM`
              : 'KPM —'}
          </small>
        </div>
        <div>
          <span>前回</span>
          <strong>
            {recent[1] ? recordPoint(recent[1]) : '—'} <small>pt</small>
          </strong>
          <small>
            {recent[1]
              ? `${recordTitle(recent[1])} · ${recent[1].kpm} KPM`
              : 'KPM —'}
          </small>
        </div>
        <div>
          <span>直近{Math.min(5, recent.length)}回の移動平均</span>
          <strong>
            {trend.at(-1)?.pointAverage.toFixed(1) ?? '—'} <small>pt</small>
          </strong>
          <small>{trend.at(-1)?.kpmAverage.toFixed(1) ?? '—'} KPM</small>
        </div>
        <div>
          <span>前回との差</span>
          <strong>
            {recent.length > 1
              ? `${recordPoint(recent[0]) - recordPoint(recent[1]) >= 0 ? '+' : ''}${recordPoint(recent[0]) - recordPoint(recent[1])}`
              : '—'}{' '}
            <small>pt</small>
          </strong>
          <small>
            {recent.length > 1
              ? `${recent[0].kpm - recent[1].kpm >= 0 ? '+' : ''}${recent[0].kpm - recent[1].kpm}`
              : '—'}{' '}
            KPM
          </small>
        </div>
      </div>
      <label>
        推移・ランキングの指標
        <Select
          label="記録の主指標"
          value={metric}
          onChange={(value) => setMetric(value as RecordMetric)}
          options={[
            { value: 'point', label: 'point（メイン）' },
            { value: 'kpm', label: 'KPM' },
          ]}
        />
      </label>
      {points.length > 0 && (
        <svg
          className="history-chart"
          viewBox="0 0 640 160"
          role="img"
          aria-label={`直近30回の${metricName}と5回移動平均`}
        >
          <text x="8" y="15">
            {maximum.toFixed(1)} {unit}
          </text>
          <polyline
            className="chart-kpm"
            points={points
              .map(
                (p, i) =>
                  `${20 + (i * 600) / Math.max(1, points.length - 1)},${140 - (recordValue(p.record, metric) / maximum) * 115}`,
              )
              .join(' ')}
          />
          {points.map((p, i) => (
            <circle
              key={p.record.id}
              cx={20 + (i * 600) / Math.max(1, points.length - 1)}
              cy={140 - (recordValue(p.record, metric) / maximum) * 115}
              r="3"
              fill="#61e8ff"
            >
              <title>
                {new Date(p.record.date).toLocaleString('ja-JP')} ·{' '}
                {recordValue(p.record, metric)} {unit}
              </title>
            </circle>
          ))}
          <polyline
            className="chart-average"
            points={points
              .map(
                (p, i) =>
                  `${20 + (i * 600) / Math.max(1, points.length - 1)},${140 - (p.average / maximum) * 115}`,
              )
              .join(' ')}
          />
          <text x="8" y="157">
            過去 → 最新 · シアン：{metricName} / 紫：移動平均
          </text>
        </svg>
      )}
      <h4>
        歴代 TOP 10{' '}
        <small>
          {metricName}順 · 同率は{metric === 'point' ? 'KPM' : 'point'}
          ・時間・実ミス・新しい日時の順
        </small>
      </h4>
      <ol className="top-records">
        {top.map((r) => (
          <li key={r.id}>
            <button onClick={() => onSelect(r)}>
              <strong>
                {recordValue(r, metric)} {unit}
              </strong>
              <span>
                {recordTitle(r)} ·{' '}
                {metric === 'point' ? `${r.kpm} KPM` : `${recordPoint(r)} pt`}
              </span>
              <span>{new Date(r.date).toLocaleString('ja-JP')}</span>
              <small>
                {r.accuracy}% · {ms(r.elapsed)} · {recordMissLabel(r)}
                {r.seed ? ` · ${r.seed}` : ''}
              </small>
            </button>
          </li>
        ))}
      </ol>
      <p className="small muted">
        同じ文章セット・配列・モード・出題バージョンを比較。CPU対戦はCPU設定も一致させます。TOP10は直近200件の保持枠から外れても残ります。移動平均は保存済みの直近履歴を使用します。
      </p>
    </section>
  )
}

export function RecordDetails({
  record,
  onClose,
  initialView = 'trend',
  onGhost,
}: {
  record: RecordEntry
  onClose: () => void
  onGhost?: (record: RecordEntry) => void
  initialView?: string
}) {
  const [loaded, setLoaded] = useState<{ trace?: SessionTrace } | null>(
    record.trace ? { trace: record.trace } : null,
  )
  const [tab, setTab] = useState(initialView)
  const [page, setPage] = useState(0)
  const [start, setStart] = useState(0)
  useEffect(() => {
    if (record.trace) return
    let cancelled = false
    void readTrace(record.id).then((trace) => {
      if (!cancelled) setLoaded({ trace })
    })
    return () => {
      cancelled = true
    }
  }, [record.id, record.trace])
  const analysis = useMemo(
    () => (loaded?.trace ? analyzeTrace(loaded.trace) : null),
    [loaded],
  )
  const trace = loaded?.trace
  const rows = analysis?.buckets.slice(start, start + 120) ?? []
  const max = Math.max(1, ...rows.map((b) => b.kpm))
  return (
    <section className="record-details" aria-label="打鍵の詳細">
      <div className="detail-heading">
        <div>
          <h3>打鍵の詳細 · {record.title}</h3>
          <p>
            <strong className="detail-point">
              {recordPoint(record)} pt · {recordTitle(record)}
            </strong>
            <br />
            {record.layout} · {record.kpm} KPM ·{' '}
            {new Date(record.date).toLocaleString('ja-JP')}
            <br />
            {recordMissLabel(record)}
          </p>
        </div>
        <button className="text-button" onClick={onClose}>
          詳細を閉じる
        </button>
      </div>
      {!loaded ? (
        <p role="status">詳細を読み込み中…</p>
      ) : !trace || !analysis ? (
        <p>
          この記録には打鍵ログがありません。旧記録の集計値は引き続き比較できます。
        </p>
      ) : (
        <>
          {onGhost && (
            <button className="primary-button" onClick={() => onGhost(record)}>
              この記録のゴーストと対戦
            </button>
          )}
          <nav className="detail-tabs" aria-label="記録の詳細表示">
            {[
              ['replay', 'リプレイ'],
              ['trend', 'KPM・ミス推移'],
              ['loss', '文字・文章のタイムロス'],
              ['keys', '全打鍵ログ'],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <p className="small muted">
            {trace.strokes.length}打鍵（実ミス{' '}
            {trace.strokes.filter((s) => !s.correct).length}）·
            一時停止を除く経過時刻。分析のKPMは有効な実打鍵数で算出し、タイプウェルの基準打鍵KPMとは区別します。
          </p>
          {tab === 'replay' && (
            <Suspense fallback={<p role="status">リプレイを準備中…</p>}>
              <ReplayPlayer
                trace={trace}
                layout={record.layout}
                strokeLimit={record.strokeLimit}
              />
            </Suspense>
          )}
          {tab === 'trend' && (
            <>
              <label>
                表示開始秒
                <input
                  aria-label="表示開始秒"
                  type="range"
                  min={0}
                  max={Math.max(0, analysis.buckets.length - 120)}
                  value={start}
                  onChange={(e) => setStart(Number(e.target.value))}
                />
              </label>
              <svg
                className="history-chart"
                viewBox="0 0 640 160"
                role="img"
                aria-label="1秒区間のKPMとミス率"
              >
                <polyline
                  className="chart-kpm"
                  points={rows
                    .map(
                      (b, i) =>
                        `${20 + (i * 600) / Math.max(1, rows.length - 1)},${140 - (b.kpm / max) * 115}`,
                    )
                    .join(' ')}
                />
                <polyline
                  className="chart-average"
                  points={rows
                    .map(
                      (b, i) =>
                        `${20 + (i * 600) / Math.max(1, rows.length - 1)},${140 - (b.missRate / 100) * 115}`,
                    )
                    .join(' ')}
                />
                <text x="8" y="15">
                  KPM 0–{max.toFixed(0)} / ミス率 0–100%
                </text>
                <text x="8" y="157">
                  {start}–{Math.min(start + 120, analysis.buckets.length)}秒 ·
                  シアン：KPM / 紫：実ミス率
                </text>
              </svg>
              <div className="detail-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>区間の終了秒</th>
                      <th>KPM</th>
                      <th>ミス率</th>
                      <th>累計ミス</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((b) => (
                      <tr key={b.time}>
                        <td>{b.time}秒</td>
                        <td>{b.kpm.toFixed(1)}</td>
                        <td>{b.missRate.toFixed(1)}%</td>
                        <td>{b.cumulative}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {tab === 'loss' && (
            <>
              <p>
                基準の打鍵間隔は正打鍵の中央値 {ms(analysis.baseline)}
                。それを超えた時間を「タイムロスの目安」として表示します。ミス原因を断定する値ではありません。末尾の未入力時間は文章に加算します。
              </p>
              <h4>時間がかかったキー · 上位20打鍵</h4>
              <div className="detail-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>問題</th>
                      <th>文字 / 期待キー</th>
                      <th>入力</th>
                      <th>間隔</th>
                      <th>超過時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.characters.slice(0, 20).map((s, i) => (
                      <tr key={i}>
                        <td>{s.prompt + 1}</td>
                        <td>
                          {s.character} / {s.expected}
                        </td>
                        <td>
                          {s.key} {s.correct ? '✓' : 'ミス'}
                        </td>
                        <td>{ms(s.dt)}</td>
                        <td>{ms(s.loss)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h4>時間がかかった文章</h4>
              <ol className="prompt-losses">
                {[...analysis.prompts]
                  .sort((a, b) => b.loss - a.loss)
                  .map((p) => (
                    <li key={p.index}>
                      <p>
                        {p.index + 1}. {p.text}
                      </p>
                      <small>
                        {p.kpm.toFixed(1)} KPM · 実ミス {p.misses} · 所要{' '}
                        {ms(p.end - p.start)} · 超過 {ms(p.loss)}
                      </small>
                    </li>
                  ))}
              </ol>
            </>
          )}
          {tab === 'keys' && (
            <>
              <div className="log-pages">
                <button disabled={!page} onClick={() => setPage((p) => p - 1)}>
                  前の100打鍵
                </button>
                <span>
                  {page * 100 + 1}–
                  {Math.min((page + 1) * 100, trace.strokes.length)} /{' '}
                  {trace.strokes.length}
                </span>
                <button
                  disabled={(page + 1) * 100 >= trace.strokes.length}
                  onClick={() => setPage((p) => p + 1)}
                >
                  次の100打鍵
                </button>
              </div>
              <div className="detail-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>経過</th>
                      <th>問題</th>
                      <th>文字</th>
                      <th>入力 / 期待</th>
                      <th>結果</th>
                      <th>間隔</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trace.strokes
                      .slice(page * 100, (page + 1) * 100)
                      .map((s, i) => (
                        <tr key={i} data-correct={s.correct}>
                          <td>{ms(s.t)}</td>
                          <td>{s.prompt + 1}</td>
                          <td>{s.character}</td>
                          <td>
                            {s.key} / {s.expected}
                          </td>
                          <td>{s.correct ? '正解' : 'ミス'}</td>
                          <td>{ms(s.dt)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}
