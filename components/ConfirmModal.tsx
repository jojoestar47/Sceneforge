import Modal, { ModalPanel } from './Modal'

interface ConfirmModalProps {
  title:        string
  body:         string
  confirmLabel?: string
  danger?:      boolean
  onConfirm:    () => void
  onClose:      () => void
}

export default function ConfirmModal({ title, body, confirmLabel = 'Confirm', danger = false, onConfirm, onClose }: ConfirmModalProps) {
  return (
    <Modal onClose={onClose} zIndex={400}>
      <ModalPanel width={380}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: '16px', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '16px 20px', fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6 }}>
          {body}
        </div>
        <div style={{ padding: '12px 20px 18px', display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className={danger ? 'btn btn-red' : 'btn btn-outline'}
            onClick={() => { onConfirm(); onClose() }}
          >
            {confirmLabel}
          </button>
        </div>
      </ModalPanel>
    </Modal>
  )
}
