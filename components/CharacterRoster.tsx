'use client'

import { useState } from 'react'
import type { Character } from '@/lib/types'
import AppIcon from '@/components/AppIcon'

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
}

export default function CharacterRoster({ characters, onDelete }: Props) {
  const [flippedId,  setFlippedId]  = useState<string | null>(null)
  const [confirmId,  setConfirmId]  = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isTouchDevice] = useState(() =>
    typeof window !== 'undefined' && navigator.maxTouchPoints > 0
  )

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
    if (!isTouchDevice) return
    if (flippedId === id) { setFlippedId(null); setConfirmId(null) }
    else setFlippedId(id)
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
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: '22px', fontWeight: 600, letterSpacing: '4px', color: 'var(--text)', marginBottom: '6px', lineHeight: 1.2 }}>
            CHARACTERS
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-2)', letterSpacing: '0.3px' }}>
            {characters.length === 0
              ? 'No characters yet — create one inside a scene editor.'
              : `${characters.length} character${characters.length !== 1 ? 's' : ''} in this campaign · Hover a card to manage`}
          </p>
        </div>

        {/* Grid */}
        {characters.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: '18px' }}>
            {characters.map(c => {
              const imgUrl    = characterImageUrl(c)
              const isFlipped = flippedId === c.id
              const isConfirm = confirmId === c.id
              const isDeleting = deletingId === c.id

              return (
                <div
                  key={c.id}
                  style={{ height: '240px', perspective: '1000px', cursor: 'pointer' }}
                  onMouseEnter={() => !isTouchDevice && setFlippedId(c.id)}
                  onMouseLeave={() => { if (!isTouchDevice) { setFlippedId(null); setConfirmId(null) } }}
                  onClick={() => handleCardClick(c.id)}
                >
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

                      {/* Hover hint */}
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
                </div>
              )
            })}
          </div>
        )}

        {/* Empty state */}
        {characters.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: '80px' }}>
            <div style={{ marginBottom: '16px' }}><AppIcon size={52} opacity={0.1} /></div>
            <p style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.8 }}>
              Characters appear here once created.<br />
              Open a scene editor to add your first character.
            </p>
          </div>
        )}
      </div>

      <style>{`
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
