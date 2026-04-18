'use client'

import { useState, useRef } from 'react'

interface Props {
  vttUrl: string | null | undefined
  onSaveUrl: (url: string) => void
}

export default function VTTView({ vttUrl, onSaveUrl }: Props) {
  const [inputVal, setInputVal]   = useState('')
  const [editing,  setEditing]    = useState(false)
  const inputRef                  = useRef<HTMLInputElement>(null)

  function handleSave() {
    const trimmed = inputVal.trim()
    if (!trimmed) return
    onSaveUrl(trimmed)
    setInputVal('')
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') { setEditing(false); setInputVal('') }
  }

  function startEditing() {
    setInputVal(vttUrl ?? '')
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 50)
  }

  if (!vttUrl || editing) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', gap: '16px',
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <path d="M8 21h8M12 17v4"/>
        </svg>
        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--text-3)', margin: 0 }}>
          {editing ? 'Change VTT Link' : 'Virtual Tabletop'}
        </p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            ref={inputRef}
            autoFocus
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste your Owlbear Rodeo room link…"
            style={{
              width: '360px', padding: '9px 14px',
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              borderRadius: '8px', color: 'var(--text)', fontSize: '13px',
              outline: 'none',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
          />
          <button
            onClick={handleSave}
            disabled={!inputVal.trim()}
            style={{
              padding: '9px 18px', borderRadius: '8px', border: 'none',
              background: inputVal.trim() ? 'var(--accent)' : 'var(--bg-raised)',
              color: inputVal.trim() ? '#000' : 'var(--text-3)',
              fontSize: '12px', fontWeight: 700, letterSpacing: '1px',
              cursor: inputVal.trim() ? 'pointer' : 'default',
              transition: 'all 0.15s',
            }}
          >Save</button>
          {editing && (
            <button
              onClick={() => { setEditing(false); setInputVal('') }}
              style={{
                padding: '9px 14px', borderRadius: '8px',
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text-3)', fontSize: '12px', cursor: 'pointer',
              }}
            >Cancel</button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        height: '36px', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '0 12px', gap: '8px', flexShrink: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <path d="M8 21h8M12 17v4"/>
        </svg>
        <span style={{
          flex: 1, fontSize: '11px', color: 'var(--text-3)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{vttUrl}</span>
        <button
          onClick={startEditing}
          style={{
            padding: '3px 10px', borderRadius: '5px', border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-3)', fontSize: '10px',
            fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
            cursor: 'pointer', flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)'; e.currentTarget.style.color = 'var(--text-2)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-3)' }}
        >Change</button>
        <a
          href={vttUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '3px 10px', borderRadius: '5px', border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-3)', fontSize: '10px',
            fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
            cursor: 'pointer', flexShrink: 0, textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: '4px',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,168,76,0.4)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-2)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-3)' }}
        >
          Open ↗
        </a>
      </div>

      {/* iframe */}
      <iframe
        src={vttUrl}
        style={{ flex: 1, border: 'none', width: '100%' }}
        allow="fullscreen; microphone; camera"
        title="Virtual Tabletop"
      />
    </div>
  )
}
