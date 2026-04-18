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

// Stable tag colour from a small palette, deterministic per tag name
const TAG_PALETTE = [
  { bg: 'rgba(201,168,76,0.15)',  border: 'rgba(201,168,76,0.4)',  text: '#c9a84c' },
  { bg: 'rgba(100,160,255,0.12)', border: 'rgba(100,160,255,0.35)', text: '#64a0ff' },
  { bg: 'rgba(160,100,240,0.12)', border: 'rgba(160,100,240,0.35)', text: '#a064f0' },
  { bg: 'rgba(80,200,130,0.12)',  border: 'rgba(80,200,130,0.35)',  text: '#50c882' },
  { bg: 'rgba(240,100,100,0.12)', border: 'rgba(240,100,100,0.35)', text: '#f06464' },
  { bg: 'rgba(240,160,60,0.12)',  border: 'rgba(240,160,60,0.35)',  text: '#f0a03c' },
]

function tagColor(tag: string) {
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0
  return TAG_PALETTE[h % TAG_PALETTE.length]
}

interface Props {
  characters:    Character[]
  onDelete:      (id: string) => Promise<void>
  onAdd:         (name: string, file: File | null, url: string) => Promise<void>
  onUpdateTags:  (id: string, tags: string[]) => Promise<void>
}

export default function CharacterRoster({ characters, onDelete, onAdd, onUpdateTags }: Props) {
  const [flippedId,  setFlippedId]  = useState<string | null>(null)
  const [confirmId,  setConfirmId]  = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // New character form
  const [addOpen,  setAddOpen]  = useState(false)
  const [newName,  setNewName]  = useState('')
  const [newFile,  setNewFile]  = useState<File | null>(null)
  const [newUrl,   setNewUrl]   = useState('')
  const [saving,   setSaving]   = useState(false)

  // Search & filter
  const [search,       setSearch]       = useState('')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())

  // Tag editing (per card)
  const [tagInput, setTagInput] = useState<Record<string, string>>({})

  // ── Derived ──────────────────────────────────────────────────
  const allTags = Array.from(new Set(characters.flatMap(c => c.tags ?? []))).sort()

  const visible = characters.filter(c => {
    const q = search.trim().toLowerCase()
    if (q && !c.name.toLowerCase().includes(q)) return false
    if (selectedTags.size > 0 && !c.tags?.some(t => selectedTags.has(t))) return false
    return true
  })

  // ── Handlers ─────────────────────────────────────────────────
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
      setAddOpen(false); setNewName(''); setNewFile(null); setNewUrl('')
    } finally {
      setSaving(false)
    }
  }

  function toggleTagFilter(tag: string) {
    setSelectedTags(prev => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })
  }

  async function addTag(c: Character, raw: string) {
    const tag = raw.trim().toLowerCase()
    if (!tag || c.tags?.includes(tag)) return
    const next = [...(c.tags ?? []), tag]
    setTagInput(prev => ({ ...prev, [c.id]: '' }))
    await onUpdateTags(c.id, next)
  }

  async function removeTag(c: Character, tag: string) {
    const next = (c.tags ?? []).filter(t => t !== tag)
    await onUpdateTags(c.id, next)
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

        {/* ── Header ── */}
        <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
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

          <button
            onClick={() => setAddOpen(v => !v)}
            style={{
              flexShrink: 0, padding: '8px 16px',
              background: addOpen ? 'rgba(201,168,76,0.12)' : 'rgba(201,168,76,0.07)',
              border: '1px solid rgba(201,168,76,0.35)', borderRadius: '8px',
              color: 'var(--accent)', fontSize: '11px', fontWeight: 700, letterSpacing: '1.2px',
              cursor: 'pointer', transition: 'background 0.15s',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,168,76,0.16)' }}
            onMouseLeave={e => { e.currentTarget.style.background = addOpen ? 'rgba(201,168,76,0.12)' : 'rgba(201,168,76,0.07)' }}
          >
            <span style={{ fontSize: '14px', lineHeight: 1 }}>+</span> NEW CHARACTER
          </button>
        </div>

        {/* ── Search + tag filters ── */}
        {characters.length > 0 && (
          <div style={{ marginBottom: '28px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Search */}
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)',
                fontSize: '13px', color: 'var(--text-3)', pointerEvents: 'none', lineHeight: 1,
              }}>⌕</span>
              <input
                className="finput"
                placeholder="Search characters…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: '30px', fontSize: '12px', padding: '8px 10px 8px 30px' }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-3)', fontSize: '14px', lineHeight: 1, padding: '2px',
                  }}
                >×</button>
              )}
            </div>

            {/* Tag filter chips */}
            {allTags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.5px', textTransform: 'uppercase', marginRight: '2px' }}>
                  Filter:
                </span>
                {allTags.map(tag => {
                  const col     = tagColor(tag)
                  const active  = selectedTags.has(tag)
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTagFilter(tag)}
                      style={{
                        padding: '3px 9px', borderRadius: '20px', cursor: 'pointer',
                        fontSize: '10px', fontWeight: 600, letterSpacing: '0.4px',
                        background: active ? col.bg  : 'rgba(255,255,255,0.04)',
                        border:     active ? `1px solid ${col.border}` : '1px solid rgba(255,255,255,0.1)',
                        color:      active ? col.text : 'var(--text-3)',
                        transition: 'all 0.15s',
                        boxShadow:  active ? `0 0 8px ${col.border}` : 'none',
                      }}
                    >
                      {tag}
                    </button>
                  )
                })}
                {selectedTags.size > 0 && (
                  <button
                    onClick={() => setSelectedTags(new Set())}
                    style={{
                      padding: '3px 8px', borderRadius: '20px', cursor: 'pointer',
                      fontSize: '10px', color: 'var(--text-3)',
                      background: 'transparent', border: '1px solid var(--border)',
                    }}
                  >
                    clear
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Add Character Form ── */}
        {addOpen && (
          <div style={{
            background: 'var(--bg-panel)', border: '1px solid var(--border-lt)',
            borderRadius: '12px', padding: '20px', marginBottom: '32px',
          }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '14px' }}>
              New Character
            </div>
            <input className="finput" placeholder="Character name" value={newName} onChange={e => setNewName(e.target.value)} style={{ fontSize: '12px', padding: '7px 10px', marginBottom: '12px' }} />
            <UploadZone accept="image/*" label="Drop character art here" icon="🧑" hint="PNG with transparency recommended — tall portrait works best" onFile={f => setNewFile(f)} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '10px 0', color: 'var(--text-3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.8px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />or paste a URL<div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>
            <input className="finput" placeholder="https://… image URL" value={newUrl} onChange={e => setNewUrl(e.target.value)} style={{ fontSize: '12px', padding: '7px 10px' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setAddOpen(false); setNewName(''); setNewFile(null); setNewUrl('') }}>Cancel</button>
              <button className="btn btn-red btn-sm" onClick={handleAdd} disabled={!newName.trim() || (!newFile && !newUrl.trim()) || saving}>
                {saving ? 'Creating…' : 'Create Character'}
              </button>
            </div>
          </div>
        )}

        {/* ── Grid ── */}
        {visible.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: '18px' }}>
            {visible.map(c => {
              const imgUrl     = characterImageUrl(c)
              const isFlipped  = flippedId === c.id
              const isConfirm  = confirmId === c.id
              const isDeleting = deletingId === c.id
              const cardTags   = c.tags ?? []

              function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
                if (isFlipped) return
                const rect = e.currentTarget.getBoundingClientRect()
                const x = (e.clientX - rect.left) / rect.width
                const y = (e.clientY - rect.top) / rect.height
                e.currentTarget.style.setProperty('--rx', `${(0.5 - y) * 22}deg`)
                e.currentTarget.style.setProperty('--ry', `${(x - 0.5) * 22}deg`)
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
                  style={{ height: '268px', perspective: '800px', cursor: 'pointer' }}
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
                          <img src={imgUrl} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <div style={{
                            width: '100%', height: '100%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'linear-gradient(135deg, var(--bg-panel) 0%, var(--bg-raised) 100%)',
                          }}>
                            <AppIcon size={44} opacity={0.18} />
                          </div>
                        )}

                        {/* Tag pills on front — show up to 3 */}
                        {cardTags.length > 0 && (
                          <div style={{
                            position: 'absolute', top: '8px', left: '8px',
                            display: 'flex', flexWrap: 'wrap', gap: '3px', maxWidth: 'calc(100% - 16px)',
                          }}>
                            {cardTags.slice(0, 3).map(tag => {
                              const col = tagColor(tag)
                              return (
                                <span key={tag} style={{
                                  padding: '2px 6px', borderRadius: '10px',
                                  fontSize: '8px', fontWeight: 700, letterSpacing: '0.3px',
                                  background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
                                  border: `1px solid ${col.border}`, color: col.text,
                                }}>
                                  {tag}
                                </span>
                              )
                            })}
                            {cardTags.length > 3 && (
                              <span style={{
                                padding: '2px 5px', borderRadius: '10px',
                                fontSize: '8px', color: 'rgba(255,255,255,0.5)',
                                background: 'rgba(0,0,0,0.45)',
                              }}>+{cardTags.length - 3}</span>
                            )}
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

                        {/* Flip hint */}
                        <div style={{
                          position: 'absolute', top: '8px', right: '8px',
                          width: '22px', height: '22px', borderRadius: '50%',
                          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', color: 'rgba(255,255,255,0.6)',
                        }}>↺</div>
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
                          alignItems: 'center',
                          padding: '14px 12px',
                          gap: '8px',
                          overflowY: 'auto',
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        {/* Mini portrait */}
                        <div style={{
                          width: '52px', height: '52px', borderRadius: '50%',
                          overflow: 'hidden', flexShrink: 0,
                          border: '2px solid var(--border-lt)',
                          background: 'var(--bg-raised)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {imgUrl
                            ? <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <AppIcon size={20} opacity={0.3} />
                          }
                        </div>

                        {/* Name */}
                        <div style={{
                          fontFamily: "'Cinzel', serif", fontSize: '10px', fontWeight: 600,
                          letterSpacing: '1.2px', textTransform: 'uppercase',
                          color: 'var(--text)', textAlign: 'center', lineHeight: 1.3,
                        }}>
                          {c.name}
                        </div>

                        {/* Date */}
                        <div style={{ fontSize: '9px', color: 'var(--text-3)', letterSpacing: '0.3px', textAlign: 'center' }}>
                          Added {formatDate(c.created_at)}
                        </div>

                        {/* ── Tags section ── */}
                        <div style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {/* Existing tags */}
                          {cardTags.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {cardTags.map(tag => {
                                const col = tagColor(tag)
                                return (
                                  <span
                                    key={tag}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '3px',
                                      padding: '2px 6px 2px 7px', borderRadius: '10px',
                                      fontSize: '9px', fontWeight: 600,
                                      background: col.bg, border: `1px solid ${col.border}`, color: col.text,
                                    }}
                                  >
                                    {tag}
                                    <button
                                      onClick={e => { e.stopPropagation(); removeTag(c, tag) }}
                                      style={{
                                        background: 'none', border: 'none', padding: '0 1px',
                                        cursor: 'pointer', color: col.text, fontSize: '10px', lineHeight: 1,
                                        opacity: 0.7,
                                      }}
                                    >×</button>
                                  </span>
                                )
                              })}
                            </div>
                          )}

                          {/* Add tag input */}
                          <input
                            className="finput"
                            placeholder="+ add tag…"
                            value={tagInput[c.id] ?? ''}
                            onChange={e => setTagInput(prev => ({ ...prev, [c.id]: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); addTag(c, tagInput[c.id] ?? '') }
                            }}
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '6px' }}
                          />
                        </div>

                        {/* Divider */}
                        <div style={{ width: '100%', height: '1px', background: 'var(--border)', flexShrink: 0 }} />

                        {/* Delete / confirm */}
                        <div style={{ width: '100%', flexShrink: 0 }}>
                          {!isConfirm ? (
                            <button
                              onClick={e => { e.stopPropagation(); setConfirmId(c.id) }}
                              style={{
                                width: '100%', padding: '6px',
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ fontSize: '9px', color: 'var(--text-2)', textAlign: 'center', lineHeight: 1.4 }}>
                                Remove from all scenes too?
                              </div>
                              <button
                                onClick={e => handleDelete(c.id, e)}
                                disabled={isDeleting}
                                style={{
                                  padding: '5px', width: '100%',
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
                                  padding: '4px', width: '100%',
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
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* No results */}
        {characters.length > 0 && visible.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: '60px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.8 }}>
              No characters match your search{selectedTags.size > 0 ? ' or filters' : ''}.
            </p>
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
