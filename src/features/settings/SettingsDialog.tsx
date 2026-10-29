import { Check, Settings2, X } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import type { Settings } from '../../domain/records/types'
import { Select } from '../../shared/ui/Select'
import { useModalFocus } from '../../shared/ui/useModalFocus'

export function SettingsDialog({
  settings,
  setSettings,
  onClose,
}: {
  settings: Settings
  setSettings: Dispatch<SetStateAction<Settings>>
  onClose: () => void
}) {
  const modalRef = useModalFocus(onClose)
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
        <button className="primary-button" onClick={() => onClose()}>
          設定を閉じる
          <Check size={15} />
        </button>
      </section>
    </div>
  )
}
