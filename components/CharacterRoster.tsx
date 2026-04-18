'use client'

import { useState } from 'react'
import type { Character } from '@/lib/types'
import AppIcon from '@/components/AppIcon'
import UploadZone from '@/components/UploadZone'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

function characterImageUrl(c: Character): string | null {
  if (c.storage_path)
    return `${SUPABASE_URL}/storage/v1/object/public/scene-media/${c.storage_path}`
  return c.url || null
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface Props {
  characters: Character[]
  onDelete:   (id: string) => Promise<void>
  onAdd:      (name: string, file: File | null, url: string) => Promise<void>
}

export default function CharacterRoster({ characters, onDelete, onAdd }: Props) {
  const [flippedId,  setFlippedId]  = useState<string | null>(null)
  const [confirmId,  setConfirmId]  = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // New character form
  const [addOpen,    setAddOpen]    = useState(false)
  const [newName,    setNewName]    = useState('')
  const [newFile,    setNewFile]    = useState<File | null>(null)
  const [newUrl,     setNewUrl]     = useState('')
  const [saving,     setSaving]     = useState(false)

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setDeletingId(id)
    try {
      await onDelete(id)
      setFlippedId(null)
      setConfirmId(null)
    } finally {
      setDeletingId(null)
    }
  }

  function handleCardClick(id: string) {
    if (flippedId === id) { setFlippedId(null); setConfirmId(null) }
    else { setFlippedId(id); setConfirmId(null) }
  }

  async function handleAdd() {
    if (!newName.trim() || (!newFile && !newUrl.trim())) return
    setSaving(true)
    try {
      await onAdd(newName.trim(), newFile, newUrl.trim())
      setAddOpen(false)
      setNewName('')
      setNewFile(null)
      setNewUrl('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', position: 'relative' }}>

      {/* Ambient background */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: [
          'radial-gradient(ellipse 55% 40% at 10% 20%, rgba(201,168,76,0.045) 0%, transparent 60%)',
          'radial-gradient(ellipse 45% 35% at 90% 80%, rgba(120,60,200,0.035) 0%, transparent 55%)',
        ].join(','),
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '1100px', margin: '0 auto', padding: '40px 40px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: '22px', fontWeight: 600, letterSpacing: '4px', color: 'var(--text)', marginBottom: '6px', lineHeight: 1.2 }}>
              CHARACTERS
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-2)', letterSpacing: '0.3px' }}>
              {characters.length === 0
                ? 'No characters yet — create your first one.'
                : `${characters.length} character${characters.length !== 1 ? 's' : ''} in this campaign · Click a card to manage`}
            </p>
          </div>

          {/* Add Character button */}
          <button
            onClick={() => { setAddOpen(v => !v) }}
            style={{
              flexShrink: 0,
              padding: '8px 16px',
              background: addOpen ? 'rgba(201,168,76,0.12)' : 'rgba(201,168,76,0.07)',
              border: '1px solid rgba(201,168,76,0.35)',
              borderRadius: '8px',
              color: 'var(--accent)',
              fontSize: '11px', fontWeight: 700, letterSpacing: '1.2px',
              cursor: 'pointer',
              transition: 'background 0.15s',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,168,76,0.16)' }}
            onMouseLeave={e => { e.currentTarget.style.background = addOpen ? 'rgba(201,168,76,0.12)' : 'rgba(201,168,76,0.07)' }}
          >
            <span style={{ fontSize: '14px', lineHeight: 1 }}>+</span> NEW CHARACTER
          </button>
        </div>

        {/* Add Character Form */}
        {addOpen && (
          <div style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-lt)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '32px',
          }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '14px' }}>
              New Character
            </div>
            <input
              className="finput"
              placeholder="Character name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              style={{ fontSize: '12px', padding: '7px 10px', marginBottom: '12px' }}
            />
            <UploadZone
              accept="image/*"
              label="Drop character art here"
              icon="🧑"
              hint="PNG with transparency recommended — tall portrait works best"
              onFile={f => setNewFile(f)}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '10px 0', color: 'var(--text-3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.8px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              or paste a URL
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>
            <input
              className="finput"
              placeholder="https://… image URL"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              style={{ fontSize: '12px', padding: '7px 10px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setAddOpen(false); setNewName(''); setNewFile(null); setNewUrl('') }}
              >
                Cancel
              </button>
              <button
                className="btn btn-red btn-sm"
                onClick={handleAdd}
                disabled={!newName.trim() || (!newFile && !newUrl.trim()) || saving}
              >
                {saving ? 'Creating…' : 'Create Character'}
              </button>
            </div>
          </div>
        )}

        {/* Grid */}
        {characters.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: '18px' }}>
            {characters.map(c => {
              const imgUrl     = characterImageUrl(c)
              const isFlipped  = flippedId === c.id
              const isConfirm  = confirmId === c.id
              const isDeleting = deletingId === c.id

              function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
                const rect = e.currentTarget.getBoundingClientRect()
                const x = (e.clientX - rect.left) / rect.width
                const y = (e.clientY - rect.top) / rect.height
                const rx = (0.5 - y) * 22
                const ry = (x - 0.5) * 22
                e.currentTarget.style.setProperty('--rx', `${rx}deg`)
                e.currentTarget.style.setProperty('--ry', `${ry}deg`)
const tilt = e.currentTarget.querySelector('.rf-tilt') as HTMLElement | null
                if (tilt) tilt.style.transition = 'transform 0.05s linear, box-shadow 0.1s ease'
              }

              function onMouseLeave(e: React.MouseEvent<HTMLDivElement>) {
                e.currentTarget.style.setProperty('--rx', '0deg')
                e.currentTarget.style.setProperty('--ry', '0deg')
                const tilt = e.currentTarget.querySelector('.rf-tilt') as HTMLElement | null
                if (tilt) tilt.style.transition = 'transform 0.6s cubic-bezier(.22,1,.36,1), box-shadow 0.4s ease'
              }

              return (
                <div
                  key={c.id}
                  className="rf-card"
                  style={{ height: '240px', perspective: '800px', cursor: 'pointer' }}
                  onMouseMove={onMouseMove}
                  onMouseLeave={onMouseLeave}
                  onClick={() => handleCardClick(c.id)}
                >
                  <div className="rf-tilt" style={{ width: '100%', height: '100%', position: 'relative' }}>
                  <div
                    className={`rf-inner${isFlipped ? ' rf-flipped' : ''}`}
                    style={{ width: '100%', height: '100%', position: 'relative' }}
                  >
                    {/* ── FRONT ── */}
                    <div
                      className="rf-face"
                      style={{
                        position: 'absolute', inset: 0,
                        borderRadius: '12px', overflow: 'hidden',
                        background: imgUrl ? 'var(--bg-raised)' : 'var(--bg-panel)',
                        border: '1px solid var(--border)',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                      }}
                    >
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={c.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      ) : (
                        <div style={{
                          width: '100%', height: '100%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'linear-gradient(135deg, var(--bg-panel) 0%, var(--bg-raised) 100%)',
                        }}>
                          <AppIcon size={44} opacity={0.18} />
                        </div>
                      )}


                      {/* Name gradient overlay */}
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        padding: '36px 10px 10px',
                        background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, transparent 100%)',
                      }}>
                        <div style={{
                          fontFamily: "'Cinzel', serif", fontSize: '10px', fontWeight: 600,
                          letterSpacing: '1.2px', textTransform: 'uppercase',
                          color: '#fff', textAlign: 'center',
                          textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                        }}>
                          {c.name}
                        </div>
                      </div>

                      {/* Click hint */}
                      <div style={{
                        position: 'absolute', top: '8px', right: '8px',
                        width: '22px', height: '22px', borderRadius: '50%',
                        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', color: 'rgba(255,255,255,0.6)',
                      }}>
                        ↺
                      </div>
                    </div>

                    {/* ── BACK ── */}
                    <div
                      className="rf-face rf-back"
                      style={{
                        position: 'absolute', inset: 0,
                        borderRadius: '12px',
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border)',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        padding: '18px 14px',
                        gap: '10px',
                      }}
                    >
                      {/* Mini portrait */}
                      <div style={{
                        width: '58px', height: '58px', borderRadius: '50%',
                        overflow: 'hidden', flexShrink: 0,
                        border: '2px solid var(--border-lt)',
                        background: 'var(--bg-raised)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {imgUrl
                          ? <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <AppIcon size={22} opacity={0.3} />
                        }
                      </div>

                      {/* Name */}
                      <div style={{
                        fontFamily: "'Cinzel', serif", fontSize: '11px', fontWeight: 600,
                        letterSpacing: '1.2px', textTransform: 'uppercase',
                        color: 'var(--text)', textAlign: 'center', lineHeight: 1.4,
                      }}>
                        {c.name}
                      </div>

                      {/* Date */}
                      <div style={{ fontSize: '9px', color: 'var(--text-3)', letterSpacing: '0.3px', textAlign: 'center' }}>
                        Added {formatDate(c.created_at)}
                      </div>

                      {/* Divider */}
                      <div style={{ width: '100%', height: '1px', background: 'var(--border)' }} />

                      {/* Delete / confirm */}
                      {!isConfirm ? (
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmId(c.id) }}
                          style={{
                            width: '100%', padding: '7px',
                            background: 'rgba(229,53,53,0.07)', border: '1px solid rgba(229,53,53,0.25)',
                            borderRadius: '7px', cursor: 'pointer',
                            color: '#e53535', fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
                            transition: 'background 0.15s ease, border-color 0.15s ease',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(229,53,53,0.16)'; e.currentTarget.style.borderColor = 'rgba(229,53,53,0.5)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(229,53,53,0.07)'; e.currentTarget.style.borderColor = 'rgba(229,53,53,0.25)' }}
                        >
                          Delete
                        </button>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '100%' }}>
                          <div style={{ fontSize: '9px', color: 'var(--text-2)', textAlign: 'center', lineHeight: 1.4 }}>
                            Remove from all scenes too?
                          </div>
                          <button
                            onClick={e => handleDelete(c.id, e)}
                            disabled={isDeleting}
                            style={{
                              padding: '6px', width: '100%',
                              background: 'rgba(229,53,53,0.15)', border: '1px solid rgba(229,53,53,0.45)',
                              borderRadius: '6px', cursor: isDeleting ? 'wait' : 'pointer',
                              color: '#e53535', fontSize: '10px', fontWeight: 700,
                            }}
                          >
                            {isDeleting ? '…' : 'Confirm'}
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmId(null) }}
                            style={{
                              padding: '5px', width: '100%',
                              background: 'transparent', border: '1px solid var(--border)',
                              borderRadius: '6px', cursor: 'pointer',
                              color: 'var(--text-3)', fontSize: '10px',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  </div>{/* /rf-tilt */}
                </div>
              )
            })}
          </div>
        )}

        {/* Empty state */}
        {characters.length === 0 && !addOpen && (
          <div style={{ textAlign: 'center', paddingTop: '80px' }}>
            <div style={{ marginBottom: '16px' }}><AppIcon size={52} opacity={0.1} /></div>
            <p style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.8 }}>
              No characters yet.<br />
              Click <strong style={{ color: 'var(--text-2)' }}>+ NEW CHARACTER</strong> above to add your first one.
            </p>
          </div>
        )}
      </div>

      <style>{`
        /* ── 3D tilt wrapper ── */
        .rf-tilt {
          transform-style: preserve-3d;
          transform: scale(1) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
          will-change: transform;
          border-radius: 12px;
        }
        .rf-card:hover .rf-tilt {
          transform: scale(1.07) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
          box-shadow: 0 28px 52px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.07);
        }

        /* ── Flip ── */
        .rf-inner {
          transform-style: preserve-3d;
          transition: transform 0.52s cubic-bezier(.22,1,.36,1);
        }
        .rf-inner.rf-flipped {
          transform: rotateY(180deg);
        }
        .rf-face {
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
        }
        .rf-back {
          transform: rotateY(180deg);
        }

      `}</style>
    </div>
  )
}
