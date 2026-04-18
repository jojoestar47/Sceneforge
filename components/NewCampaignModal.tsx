interface NewCampaignModalProps {
  value:    string
  onChange: (v: string) => void
  onCreate: () => void
  onClose:  () => void
}

export default function NewCampaignModal({ value, onChange, onCreate, onClose }: NewCampaignModalProps) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '10px', width: '400px', maxWidth: '94vw', boxShadow: '0 24px 70px rgba(0,0,0,.85)' }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>New Campaign</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: '16px', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '18px 20px' }}>
          <label className="flabel">Campaign Name</label>
          <input
            className="finput"
            placeholder="The Lost Mines of Phandelver…"
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onCreate()}
            autoFocus
          />
        </div>
        <div style={{ padding: '12px 20px 18px', display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-red" onClick={onCreate}>Create Campaign</button>
        </div>
      </div>
    </div>
  )
}
