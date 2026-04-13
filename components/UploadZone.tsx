'use client'

import { useRef, useState } from 'react'

interface Props {
  accept: string
  label: string
  icon: string
  hint: string
  onFile: (file: File) => void
}

export default function UploadZone({ accept, label, icon, hint, onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver]   = useState(false)
  const [picked, setPicked] = useState<File | null>(null)

  function handleFile(file: File) {
    setPicked(file)
    onFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const fmtSize = (b: number) =>
    b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${(b / 1e3).toFixed(0)} KB`

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
      />

      {picked ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'var(--editor-row)', borderRadius: '8px', padding: '10px 12px',
          border: '1px solid var(--border-lt)',
        }}>
          <span style={{ fontSize: '22px' }}>{icon}</span>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {picked.name}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }}>
              {fmtSize(picked.size)}
            </div>
          </div>
          <button
            onClick={() => setPicked(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${over ? 'var(--accent)' : 'var(--border-lt)'}`,
            borderRadius: '8px', padding: '20px 16px', textAlign: 'center',
            cursor: 'pointer', transition: 'all .15s',
            background: over ? 'var(--accent-bg)' : 'transparent',
          }}
        >
          <div style={{ fontSize: '26px', marginBottom: '8px', opacity: .6 }}>{icon}</div>
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>{label}</div>
          <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>{hint}</div>
        </div>
      )}
    </div>
  )
}
