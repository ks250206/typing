import { useModalFocus } from '../../shared/ui/useModalFocus'
import { useEffect, useRef, useState } from 'react'

export function ClearHistoryDialog({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: () => Promise<boolean>
}) {
  const locked = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const close = () => {
    if (!locked.current) onClose()
  }
  const modalRef = useModalFocus(close)
  useEffect(() => {
    if (busy) modalRef.current?.focus()
    else modalRef.current?.querySelector('button')?.focus()
  }, [busy, modalRef])
  const confirm = async () => {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError('')
    try {
      if (await onConfirm()) onClose()
      else
        setError(
          '記録を削除できませんでした。保存設定を確認して、もう一度お試しください。',
        )
    } catch {
      setError('記録を削除できませんでした。もう一度お試しください。')
    } finally {
      locked.current = false
      setBusy(false)
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        ref={modalRef}
        role="alertdialog"
        aria-modal="true"
        aria-busy={busy}
        tabIndex={-1}
        aria-labelledby="clear-title"
      >
        <h2 id="clear-title">すべての記録を削除しますか？</h2>
        <p>
          履歴・TOP記録・打鍵ログをすべて削除します。この操作は取り消せません。必要な記録は
          JSON に書き出してください。設定と文章セットは残ります。
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="modal-actions">
          <button disabled={busy} onClick={close}>
            キャンセル
          </button>
          <button className="primary-button" disabled={busy} onClick={confirm}>
            {busy ? '削除中…' : '削除する'}
          </button>
        </div>
      </section>
    </div>
  )
}
