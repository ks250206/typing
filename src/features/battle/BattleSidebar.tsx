import type { Settings } from '../../domain/records/types'
import type { Dispatch, SetStateAction } from 'react'
import { layoutLabels } from '../../domain/typing/engine'
import type { Layout } from '../../domain/typing/engine'
import { typingTitle, formatMissRate } from '../../domain/typing/scoring'
import { time } from '../../shared/formatTime'

export function BattleSidebar({
  settings,
  setSettings,
  layout,
  keys,
  misses,
  point,
  elapsed,
  accuracy,
  rounds,
  cpu,
}: {
  settings: Settings
  setSettings: Dispatch<SetStateAction<Settings>>
  layout: Layout
  keys: number
  misses: number
  point: number
  elapsed: number
  accuracy: number
  rounds: string
  cpu: string
}) {
  return (
    <aside
      className="session-sidebar battle-sidebar"
      aria-label="対戦のサイドバー"
    >
      <div className="session-card">
        <span className="tiny-label">THIS DUEL</span>
        <div className="point-panel">
          <strong>
            {point}
            <small> pt</small>
          </strong>
          <span>{typingTitle(point, keys, misses)}</span>
          <small>実ミス率 {formatMissRate(keys, misses)}</small>
        </div>
        <div className="primary-stat">
          <span>{elapsed ? Math.round((keys * 60000) / elapsed) : 0}</span>
          <span>
            KPM<small>正しく打ったキー / 分</small>
          </span>
        </div>
        <div className="stat-grid">
          <div>
            <span>正確率</span>
            <strong>{(accuracy * 100).toFixed(1)}%</strong>
          </div>
          <div>
            <span>経過時間</span>
            <strong>{time(elapsed)}</strong>
          </div>
        </div>
        <div className="miss-stat">
          <span>実ミス</span>
          <strong>{misses}</strong>
          <span>打鍵</span>
          <strong>{keys}</strong>
        </div>
        <p className="battle-sidebar-rounds">ROUND {rounds} / BO7</p>
        <p className="small muted">
          {layoutLabels[layout]}
          <br />
          CPU {cpu}
        </p>
      </div>
      <div className="config-card">
        <span className="tiny-label">DISPLAY</span>
        {(
          [
            ['background', '3D 背景'],
            ['wordColors', '単語の色分け'],
            ['consumeTyped', '入力済み単語を消す'],
          ] as const
        ).map(([key, label]) => (
          <label className="toggle-row" key={key}>
            <span>{label}</span>
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(e) =>
                setSettings((s) => ({ ...s, [key]: e.target.checked }))
              }
            />
          </label>
        ))}
        <p className="config-help">
          Escで一時停止。入力領域からフォーカスが外れたときも両者の時計を止めます。
        </p>
      </div>
    </aside>
  )
}
