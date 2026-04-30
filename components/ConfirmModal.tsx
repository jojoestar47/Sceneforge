interface ConfirmModalProps {
  title:      string
  body:       string
  confirmLabel?: string
  danger?:    boolean
  onConfirm:  () => void
  onClose:    () => void
}

export default function ConfirmModal({ title, body, confirmLabel = 'Confirm', danger = false, onConfirm, onClose }: ConfirmModalProps) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '10px', width: '380px', maxWidth: '94vw', boxShadow: '0 24px 70px rgba(0,0,0,.85)' }}>
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
            className={danger ? 'btn btn-red' : 'btn btn-primary'}
            onClick={() => { onConfirm(); onClose() }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
