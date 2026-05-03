import Modal, { ModalPanel } from './Modal'

interface NewCampaignModalProps {
  value:    string
  onChange: (v: string) => void
  onCreate: () => void
  onClose:  () => void
}

export default function NewCampaignModal({ value, onChange, onCreate, onClose }: NewCampaignModalProps) {
  return (
    <Modal onClose={onClose} zIndex={300}>
      <ModalPanel width={400}>
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
      </ModalPanel>
    </Modal>
  )
}
