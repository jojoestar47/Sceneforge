'use client'

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { MediaRef } from '@/lib/types'
import { mediaUrl } from '@/lib/media'
import UploadZone from '@/components/UploadZone'
import { Section } from './parts'
import type { Draft } from './types'

interface Props {
  draft:    Draft
  setDraft: Dispatch<SetStateAction<Draft>>
}

export default function HandoutsTab({ draft, setDraft }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [url,  setUrl]  = useState('')

  function reset() {
    setOpen(false); setName(''); setFile(null); setUrl('')
  }

  function add() {
    if (!name.trim() || (!file && !url)) return
    const media: MediaRef | null = file
      ? { type: 'image', file_name: file.name }
      : url
      ? { type: 'image', url }
      : null
    setDraft(d => ({
      ...d,
      handouts: [...d.handouts, { name: name.trim(), media, _file: file || undefined }],
    }))
    reset()
  }

  return (
    <div style={{ paddingTop: '20px' }}>
      <Section title="Handouts">
        {/* Handout list */}
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {draft.handouts.map((h, idx) => {
            const imgUrl = mediaUrl(h.media)
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--editor-row)', borderRadius: '8px', padding: '10px 12px', marginTop: '8px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '6px', background: 'var(--editor-card)', border: '1px solid var(--border-lt)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {imgUrl
                    ? <img src={imgUrl} alt={h.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : h._file
                    ? <BlobImage file={h._file} alt={h.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: '18px', opacity: 0.4 }}>🗺</span>
                  }
                </div>
                <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h.name || 'Untitled'}
                </span>
                <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }}
                  onClick={() => setDraft(d => ({ ...d, handouts: d.handouts.filter((_, i) => i !== idx) }))}>
                  Remove
                </button>
              </div>
            )
          })}
          {draft.handouts.length === 0 && (
            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '12px', color: 'var(--text-3)' }}>
              No handouts yet — add maps, images, or documents below.
            </div>
          )}
        </div>

        {/* Add handout */}
        <div style={{ paddingTop: '12px' }}>
          <button className={`add-pill${open ? ' active' : ''}`} style={{ fontSize: '10px', padding: '6px 12px' }}
            onClick={() => { open ? reset() : setOpen(true) }}>
            + ADD HANDOUT <span style={{ fontSize: '9px' }}>▼</span>
          </button>
          {open && (
            <div style={{ background: 'var(--editor-card)', border: '1px solid var(--border-lt)', borderRadius: '8px', padding: '14px', marginTop: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '10px' }}>New Handout</div>
              <input className="finput" placeholder="Name (e.g. Treasure Map, Letter from the King)" value={name}
                onChange={e => setName(e.target.value)}
                style={{ fontSize: '12px', padding: '7px 10px', marginBottom: '10px' }} />
              <UploadZone accept="image/*" label="Drop image here" icon="🗺" hint="PNG, JPG, WebP"
                onFile={f => setFile(f)} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0', color: 'var(--text-3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.8px' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />or paste a URL<div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>
              <input className="finput" placeholder="https://… image URL" value={url}
                onChange={e => setUrl(e.target.value)}
                style={{ fontSize: '12px', padding: '7px 10px' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button className="btn btn-ghost btn-sm" onClick={reset}>Cancel</button>
                <button className="btn btn-red btn-sm"
                  disabled={!name.trim() || (!file && !url)}
                  onClick={add}>
                  Add Handout
                </button>
              </div>
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}

/** Renders a local File as an <img> using a blob URL, revoking it on unmount. */
function BlobImage({ file, alt, style }: { file: File; alt: string; style: React.CSSProperties }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  if (!src) return null
  return <img src={src} alt={alt} style={style} />
}
