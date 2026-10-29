import { useModalFocus } from '../../shared/ui/useModalFocus'

export function ClearHistoryDialog({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: () => Promise<boolean>
}) {
  const modalRef = useModalFocus(onClose)
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        ref={modalRef}
        role="alertdialog"
        aria-labelledby="clear-title"
      >
        <h2 id="clear-title">すべての記録を削除しますか？</h2>
        <p>
          この操作は取り消せません。必要な記録は JSON に書き出してください。
        </p>
        <div className="modal-actions">
          <button onClick={() => onClose()}>キャンセル</button>
          <button
            className="primary-button"
            onClick={async () => {
              if (await onConfirm()) onClose()
            }}
          >
            削除する
          </button>
        </div>
      </section>
    </div>
  )
}
