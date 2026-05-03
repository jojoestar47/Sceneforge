import Modal, { ModalPanel } from './Modal'

interface ShareLiveModalProps {
  joinCode:  string
  viewerUrl: string
  qrUrl:     string | null
  copied:    boolean
  onCopy:    () => void
  onClose:   () => void
  onStop:    () => void
}

export default function ShareLiveModal({
  joinCode, viewerUrl, qrUrl, copied, onCopy, onClose, onStop,
}: ShareLiveModalProps) {
  return (
    <Modal onClose={onClose} zIndex={300}>
      <ModalPanel width={460} style={{ overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)', animation: 'livePulse 1.5s ease-in-out infinite', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: '14px' }}>Session Live</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: '16px', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Body */}
        <div className="slm-body">
          {/* QR code */}
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            {qrUrl && (
              <div style={{ background: '#fff', borderRadius: '10px', padding: '8px', display: 'inline-block', lineHeight: 0 }}>
                <img src={qrUrl} alt="Scan to open viewer" width={160} height={160} style={{ display: 'block', borderRadius: '4px' }} />
              </div>
            )}
            <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.5px' }}>Scan with tablet</div>
          </div>

          {/* Details */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '14px' }}>
              Scan the QR code or open the URL on any device. Switch scenes from{' '}
              <strong style={{ color: 'var(--text)' }}>any logged-in device</strong>.
            </div>

            <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', marginBottom: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '4px' }}>Join Code</div>
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: '20px', letterSpacing: '6px', color: 'var(--accent)', fontWeight: 600 }}>{joinCode}</div>
            </div>

            <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text)', wordBreak: 'break-all', fontFamily: 'monospace', lineHeight: 1.5 }}>{viewerUrl}</div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: '11px' }} onClick={onCopy}>
                {copied ? '✓ Copied!' : 'Copy URL'}
              </button>
              <button className="btn btn-red" style={{ flex: 1, justifyContent: 'center', fontSize: '11px' }} onClick={() => window.open(viewerUrl, '_blank')}>
                Open Viewer ↗
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px 16px', display: 'flex', justifyContent: 'center', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', borderColor: 'rgba(229,53,53,0.3)' }} onClick={onStop}>
            ⏹ Stop Presenting
          </button>
        </div>
      </ModalPanel>
      <style>{`
        .slm-body {
          padding: 22px 24px;
          display: flex;
          gap: 20px;
          align-items: flex-start;
        }
        @media (max-width: 440px) {
          .slm-body {
            flex-direction: column;
            align-items: center;
          }
        }
      `}</style>
    </Modal>
  )
}
