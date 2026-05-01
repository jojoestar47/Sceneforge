'use client'

// Layout primitives shared by every editor tab. Kept dumb on purpose —
// no editor state lives here, just visual structure.

import { useState } from 'react'

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: '28px' }}>
      <div style={{ fontFamily: "'Cinzel Decorative','Cinzel',serif", fontSize: '15px', fontWeight: 700, color: 'var(--text)', letterSpacing: '1px', paddingBottom: '10px', borderBottom: '2px solid var(--accent)', display: 'block', marginBottom: 0 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

export function PropRow({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid var(--border)', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--text)', marginBottom: '4px' }}>{label}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{desc}</div>
        </div>
        <button className={`add-pill${open ? ' active' : ''}`} onClick={() => setOpen(o => !o)}>
          {open ? 'CLOSE' : 'ADD'} <span style={{ fontSize: '9px' }}>▼</span>
        </button>
      </div>
      {open && (
        <div style={{ background: 'var(--editor-card)', border: '1px solid var(--border-lt)', borderRadius: '8px', padding: '16px', marginBottom: '4px' }}>
          {children}
        </div>
      )}
    </>
  )
}
