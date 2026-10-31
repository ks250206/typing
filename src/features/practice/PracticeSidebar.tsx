import { AudioLines, Clock3, Command, Sparkles, Target } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { recordPoint } from '../../domain/records/recordStats'
import type { RecordEntry, Settings } from '../../domain/records/types'
import type { Layout } from '../../domain/typing/engine'
import { layoutLabels } from '../../domain/typing/engine'
import { formatMissRate, typingTitle } from '../../domain/typing/scoring'
import { time } from '../../shared/formatTime'
import { Select } from '../../shared/ui/Select'
import type { PracticeSession } from './usePracticeSession'

export function PracticeSidebar({
  session,
  settings,
  setSettings,
  records,
  bestRecords,
}: {
  session: Pick<
    PracticeSession,
    | 'selected'
    | 'durationMs'
    | 'status'
    | 'elapsed'
    | 'keys'
    | 'misses'
    | 'rawMisses'
    | 'point'
    | 'kpm'
    | 'accuracy'
    | 'reset'
  >
  settings: Settings
  setSettings: Dispatch<SetStateAction<Settings>>
  records: RecordEntry[]
  bestRecords: RecordEntry[]
}) {
  const {
    selected,
    durationMs,
    status,
    elapsed,
    keys,
    misses,
    rawMisses,
    point,
    kpm,
    accuracy,
    reset,
  } = session
  const comparableRecords = [...records, ...bestRecords].filter(
    (r) =>
      r.passageId === selected &&
      r.layout === settings.layout &&
      r.mode !== 'cpu' &&
      r.mode !== 'ghost',
  )
  const best = comparableRecords.reduce(
    (n, r) => Math.max(n, recordPoint(r)),
    0,
  )
  const bestKpm = comparableRecords.reduce((n, r) => Math.max(n, r.kpm), 0)

  return (
    <aside className="session-sidebar">
      <div className="session-card">
        <div className="card-heading">
          <span className="tiny-label">THIS SESSION</span>
          <AudioLines size={15} />
        </div>
        <div className="point-panel">
          <strong>
            {point}
            <small> pt</small>
          </strong>
          <span>{typingTitle(point, keys, rawMisses)}</span>
          <small>
            {keys + rawMisses
              ? `実ミス率 ${formatMissRate(keys, rawMisses)}`
              : '入力後に精度称号を判定'}
          </small>
          <small>正打鍵KPM × 補正正確率²</small>
          <small>連続ミス減点 1 / .75 / .5 / .35 / .25（5回〜）</small>
        </div>
        <div className="primary-stat">
          <span>{kpm}</span>
          <span>
            KPM<small>正しく打ったキー / 分</small>
          </span>
        </div>
        <div className="stat-grid">
          <div>
            <Target size={14} />
            <span>正確率</span>
            <strong>
              {accuracy.toFixed(1)}
              <small>%</small>
            </strong>
          </div>
          <div>
            <Clock3 size={14} />
            <span>経過時間</span>
            <strong>{time(elapsed)}</strong>
          </div>
        </div>
        <div className="miss-stat">
          <span>ミス</span>
          <strong>{durationMs ? rawMisses : misses}</strong>
          {!durationMs && rawMisses !== misses && (
            <small>実ミス {rawMisses} 打鍵</small>
          )}
          <span>打鍵</span>
          <strong>{keys}</strong>
        </div>
        <div className="best">
          <Sparkles size={14} />
          <span>この文章の自己ベスト</span>
          <strong>
            {best || '—'}
            <small> pt</small>
            <span className="best-kpm">KPM最高 {bestKpm || '—'}</span>
          </strong>
        </div>
      </div>
      <div
        className="config-card"
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest('.toggle-row'))
            e.preventDefault()
        }}
      >
        <span className="tiny-label">INPUT STYLE</span>
        <label htmlFor="layout">入力方式</label>
        <Select
          id="layout"
          label="入力方式"
          value={settings.layout}
          disabled={
            status === 'running' ||
            status === 'paused' ||
            status === 'countdown'
          }
          options={Object.entries(layoutLabels).map(([value, label]) => ({
            value,
            label,
          }))}
          onChange={(value) => {
            const layout = value as Layout
            setSettings((s) => ({ ...s, layout }))
            reset(selected, layout)
          }}
        />
        <label className="toggle-row">
          <span>3D 背景</span>
          <input
            type="checkbox"
            checked={settings.background}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                background: e.target.checked,
              }))
            }
          />
        </label>
        <div
          className="display-options"
          onMouseDown={(e) => e.preventDefault()}
        >
          <label className="toggle-row">
            <span>単語の色分け</span>
            <input
              type="checkbox"
              checked={settings.wordColors}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  wordColors: e.target.checked,
                }))
              }
            />
          </label>
          <label className="toggle-row">
            <span>入力済み単語を消す</span>
            <input
              type="checkbox"
              checked={settings.consumeTyped}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  consumeTyped: e.target.checked,
                }))
              }
            />
          </label>
        </div>
        <p className="config-help">
          IME を OFF にして入力。
          <br />
          {settings.layout === 'azerty'
            ? 'OSはQWERTY。数字はShift、記号はAltGrまたはCtrl+Altを使います。'
            : ['dvorak', 'colemak', 'workman', 'onishi', 'norman'].includes(
                  settings.layout,
                )
              ? `物理キーを ${layoutLabels[settings.layout]} 配列に変換します。OS は QWERTY に設定。`
              : settings.layout === 'kana'
                ? 'JIS 物理配列に対応。濁点・半濁点は別打鍵です。'
                : 'し → shi / si など、打ち方は自由。'}
        </p>
      </div>
      <div className="tip">
        <Command size={17} />
        <p>
          速さよりも、流れを。
          <br />
          <span>
            先の文章を読みながら、
            <br />
            自分のリズムを見つけましょう。
          </span>
        </p>
      </div>
    </aside>
  )
}
