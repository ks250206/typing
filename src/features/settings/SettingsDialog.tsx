import { displayScales } from '../../domain/records/displayScale'
import { Check, Settings2, Trash2, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Settings } from '../../domain/records/types'
import { Select } from '../../shared/ui/Select'
import { useModalFocus } from '../../shared/ui/useModalFocus'

export function SettingsDialog({
  settings,
  setSettings,
  onClose,
  onRequestClear,
  focusClear = false,
}: {
  settings: Settings
  setSettings: Dispatch<SetStateAction<Settings>>
  onClose: () => void
  onRequestClear: () => void
  focusClear?: boolean
}) {
  const modalRef = useModalFocus(onClose)
  const clearButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (focusClear) clearButton.current?.focus()
  }, [focusClear])
  return (
    <div className="modal-backdrop" onClick={() => onClose()}>
      <section
        className="modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="close" aria-label="閉じる" onClick={() => onClose()}>
          <X />
        </button>
        <Settings2 size={22} />
        <h2 id="settings-title">あなたの集中環境</h2>
        <p>
          入力方式は練習画面で選べます。配列を切り替えると、練習は最初からになります。
        </p>
        <div className="navigation-motion-setting">
          <label htmlFor="display-scale">画面の表示倍率</label>
          <Select
            id="display-scale"
            label="画面の表示倍率"
            value={String(settings.displayScale)}
            options={displayScales.map((scale) => ({
              value: String(scale),
              label: `${scale}%${scale === 100 ? '（標準）' : ''}`,
            }))}
            onChange={(value) =>
              setSettings((s) => ({ ...s, displayScale: Number(value) }))
            }
          />
          <p>画面全体の大きさを変更します。設定は自動保存されます。</p>
          <button
            className="text-button"
            disabled={settings.displayScale === 100}
            onClick={() => setSettings((s) => ({ ...s, displayScale: 100 }))}
          >
            100%に戻す
          </button>
        </div>
        <label className="toggle-row">
          3D 背景
          <input
            type="checkbox"
            checked={settings.background}
            onChange={(e) =>
              setSettings((s) => ({ ...s, background: e.target.checked }))
            }
          />
        </label>
        <div className="navigation-motion-setting">
          <label htmlFor="navigation-motion">
            画面切り替えのアニメーション
          </label>
          <Select
            id="navigation-motion"
            label="画面切り替えのアニメーション"
            value={settings.navigationMotion}
            options={[
              { value: 'on', label: 'オン' },
              { value: 'system', label: 'OSに合わせる' },
              { value: 'off', label: 'オフ' },
            ]}
            onChange={(value) =>
              setSettings((s) => ({
                ...s,
                navigationMotion: value as typeof s.navigationMotion,
              }))
            }
          />
          <p>
            ページ・カルーセルの切り替え専用です。オンではOSの「動きを減らす」が有効でも動きます。
          </p>
        </div>
        <p>
          記録と設定はこのブラウザのみに保存されます。ブラウザのデータを消すと失われるため、記録画面から書き出しておけます。
        </p>
        <section className="settings-records" aria-label="記録の管理">
          <h3>記録の管理</h3>
          <p>
            保存済みの履歴・TOP記録・打鍵ログをすべて削除します。設定と文章セットは残ります。
          </p>
          <button
            ref={clearButton}
            className="danger-button"
            onClick={onRequestClear}
          >
            <Trash2 size={15} />
            記録をすべて消去
          </button>
        </section>
        <button className="primary-button" onClick={() => onClose()}>
          設定を閉じる
          <Check size={15} />
        </button>
      </section>
    </div>
  )
}
