'use client'

import { memo, useCallback, useMemo, useState } from 'react'
import type { Character, CampaignTag } from '@/lib/types'
import { publicStorageUrl } from '@/lib/supabase/storage'
import AppIcon from '@/components/AppIcon'
import UploadZone from '@/components/UploadZone'

// Legacy named colours kept for any existing DB rows
const LEGACY_COLORS: Record<string, string> = {
  gold: '#c9a84c', blue: '#64a0ff', purple: '#a064f0',
  green: '#50c882', red: '#f06464', orange: '#f0a03c',
}

function getColor(color: string) {
  const hex = color.startsWith('#') ? color : (LEGACY_COLORS[color] ?? '#c9a84c')
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return {
    bg:     `rgba(${r},${g},${b},0.15)`,
    border: `rgba(${r},${g},${b},0.4)`,
    text:   hex,
  }
}

function EditIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 494.936 494.936" fill="currentColor" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M389.844,182.85c-6.743,0-12.21,5.467-12.21,12.21v222.968c0,23.562-19.174,42.735-42.736,42.735H67.157
        c-23.562,0-42.736-19.174-42.736-42.735V150.285c0-23.562,19.174-42.735,42.736-42.735h267.741c6.743,0,12.21-5.467,12.21-12.21
        s-5.467-12.21-12.21-12.21H67.157C30.126,83.13,0,113.255,0,150.285v267.743c0,37.029,30.126,67.155,67.157,67.155h267.741
        c37.03,0,67.156-30.126,67.156-67.155V195.061C402.054,188.318,396.587,182.85,389.844,182.85z"/>
      <path d="M483.876,20.791c-14.72-14.72-38.669-14.714-53.377,0L221.352,229.944c-0.28,0.28-3.434,3.559-4.251,5.396l-28.963,65.069
        c-2.057,4.619-1.056,10.027,2.521,13.6c2.337,2.336,5.461,3.576,8.639,3.576c1.675,0,3.362-0.346,4.96-1.057l65.07-28.963
        c1.83-0.815,5.114-3.97,5.396-4.25L483.876,74.169c7.131-7.131,11.06-16.61,11.06-26.692
        C494.936,37.396,491.007,27.915,483.876,20.791z M466.61,56.897L257.457,266.05c-0.035,0.036-0.055,0.078-0.089,0.107
        l-33.989,15.131L238.51,247.3c0.03-0.036,0.071-0.055,0.107-0.09L447.765,38.058c5.038-5.039,13.819-5.033,18.846,0.005
        c2.518,2.51,3.905,5.855,3.905,9.414C470.516,51.036,469.127,54.38,466.61,56.897z"/>
    </svg>
  )
}

function characterImageUrl(c: Character): string | null {
  return c.storage_path ? publicStorageUrl(c.storage_path) : (c.url || null)
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface Props {
  characters:   Character[]
  campaignTags: CampaignTag[]
  onDelete:     (id: string) => Promise<void>
  onAdd:        (name: string, file: File | null, url: string) => Promise<void>
  onUpdateTags: (id: string, tagIds: string[]) => Promise<void>
  onUpdateName: (id: string, name: string) => Promise<void>
  onCreateTag:  (name: string, color: string) => Promise<void>
  onDeleteTag:  (id: string) => Promise<void>
}

interface CharacterCardProps {
  c:             Character
  campaignTags:  CampaignTag[]
  tagMap:        Map<string, CampaignTag>
  isFlipped:     boolean
  isConfirm:     boolean
  isDeleting:    boolean
  isEditingName: boolean
  editingNameVal: string
  nameSaving:    boolean
  onFlip:        (id: string) => void
  onSetConfirm:  (id: string | null) => void
  onDelete:      (id: string, e: React.MouseEvent) => void
  onStartEditName: (id: string, currentName: string) => void
  onChangeEditName: (val: string) => void
  onCancelEditName: () => void
  onSaveName:    (c: Character) => void
  onToggleTag:   (c: Character, tagId: string) => void
}

function onMouseMove(e: React.MouseEvent<HTMLDivElement>, isFlipped: boolean) {
  if (isFlipped) return
  const rect = e.currentTarget.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height
  e.currentTarget.style.setProperty('--rx', `${(0.5 - y) * 22}deg`)
  e.currentTarget.style.setProperty('--ry', `${(x - 0.5) * 22}deg`)
  const tilt = e.currentTarget.querySelector('.rf-tilt') as HTMLElement | null
  if (tilt) tilt.style.transition = 'transform 0.05s linear, box-shadow 0.1s ease'
}

function onCardMouseLeave(e: React.MouseEvent<HTMLDivElement>) {
  e.currentTarget.style.setProperty('--rx', '0deg')
  e.currentTarget.style.setProperty('--ry', '0deg')
  const tilt = e.currentTarget.querySelector('.rf-tilt') as HTMLElement | null
  if (tilt) tilt.style.transition = 'transform 0.6s cubic-bezier(.22,1,.36,1), box-shadow 0.4s ease'
}

const CharacterCard = memo(function CharacterCard({
  c, campaignTags, tagMap,
  isFlipped, isConfirm, isDeleting, isEditingName,
  editingNameVal, nameSaving,
  onFlip, onSetConfirm, onDelete,
  onStartEditName, onChangeEditName, onCancelEditName, onSaveName, onToggleTag,
}: CharacterCardProps) {
  const imgUrl = characterImageUrl(c)
  const cardTags   = c.tags ?? []

  return (
    <div
      className="rf-card"
      style={{ height: 'clamp(220px, 35vw, 310px)', perspective: '800px' }}
      onMouseMove={e => onMouseMove(e, isFlipped)}
      onMouseLeave={onCardMouseLeave}
    >
      {/* When flipped: override tilt/scale so back-face text renders crisply */}
      <div className="rf-tilt" style={{ width: '100%', height: '100%', position: 'relative', ...(isFlipped && { transform: 'none' }) }}>
        <div
          className={`rf-inner${isFlipped ? ' rf-flipped' : ''}`}
          style={{ width: '100%', height: '100%', position: 'relative' }}
        >

          {/* ── FRONT ── */}
          <div
            className="rf-face"
            style={{
              position: 'absolute', inset: 0, borderRadius: '12px', overflow: 'hidden',
              background: imgUrl ? 'var(--bg-raised)' : 'var(--bg-panel)',
              border: '1px solid var(--border)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              pointerEvents: isFlipped ? 'none' : 'auto',
            }}
          >
            {imgUrl ? (
              <img src={imgUrl} alt={c.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--bg-panel) 0%, var(--bg-raised) 100%)' }}>
                <AppIcon size={48} opacity={0.18} />
              </div>
            )}

            {/* Tag pills — top left */}
            {cardTags.length > 0 && (
              <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', flexWrap: 'wrap', gap: '3px', maxWidth: 'calc(100% - 40px)' }}>
                {cardTags.slice(0, 3).map(tagId => {
                  const tag = tagMap.get(tagId)
                  if (!tag) return null
                  const col = getColor(tag.color)
                  return (
                    <span key={tagId} style={{
                      padding: '2px 7px', borderRadius: '10px',
                      fontSize: '9px', fontWeight: 700, letterSpacing: '0.3px',
                      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
                      border: `1px solid ${col.border}`, color: col.text,
                    }}>
                      {tag.name}
                    </span>
                  )
                })}
                {cardTags.length > 3 && (
                  <span style={{ padding: '2px 6px', borderRadius: '10px', fontSize: '9px', color: 'rgba(255,255,255,0.5)', background: 'rgba(0,0,0,0.5)' }}>
                    +{cardTags.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Name overlay */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '40px 12px 12px', background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)' }}>
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: '11px', fontWeight: 600, letterSpacing: '1.4px', textTransform: 'uppercase', color: '#fff', textAlign: 'center', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
                {c.name}
              </div>
            </div>

            {/* Manage button — only way to flip */}
            <button
              onClick={e => { e.stopPropagation(); onFlip(c.id) }}
              title="Manage character"
              style={{
                position: 'absolute', top: '8px', right: '8px',
                padding: '4px 9px', borderRadius: '20px', cursor: 'pointer',
                background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
                border: '1px solid rgba(255,255,255,0.22)',
                fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px',
                color: 'rgba(255,255,255,0.8)',
                display: 'flex', alignItems: 'center', gap: '4px',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)' }}
            >
              ↺ Edit
            </button>
          </div>

          {/* ── BACK ── */}
          <div
            className="rf-face rf-back"
            style={{
              position: 'absolute', inset: 0, borderRadius: '12px',
              background: 'var(--bg-panel)', border: '1px solid var(--border)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '12px', gap: '8px', overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Flip back button */}
            <button
              onClick={e => { e.stopPropagation(); onFlip(c.id) }}
              style={{
                position: 'absolute', top: '8px', right: '8px',
                width: '22px', height: '22px', borderRadius: '50%', padding: 0,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', color: 'var(--text-3)', cursor: 'pointer',
              }}
              title="Flip back"
            >↺</button>

            {/* Portrait */}
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid var(--border-lt)', background: 'var(--bg-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {imgUrl ? <img src={imgUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <AppIcon size={22} opacity={0.3} />}
            </div>

            {/* Name + rename */}
            <div style={{ width: '100%', textAlign: 'center' }}>
              {isEditingName ? (
                <input
                  autoFocus
                  className="finput"
                  value={editingNameVal}
                  onChange={e => onChangeEditName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') onSaveName(c)
                    if (e.key === 'Escape') onCancelEditName()
                  }}
                  onBlur={() => onSaveName(c)}
                  style={{ fontSize: '13px', padding: '6px 10px', textAlign: 'center', width: '100%' }}
                  disabled={nameSaving}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', width: '100%' }}>
                  <span style={{
                    fontFamily: "'Cinzel', serif", fontSize: '12px', fontWeight: 600,
                    letterSpacing: '0.8px', color: 'var(--text)', lineHeight: 1.3,
                    wordBreak: 'break-word', textAlign: 'center',
                    WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale',
                  }}>
                    {c.name}
                  </span>
                  <button
                    onClick={() => onStartEditName(c.id, c.name)}
                    title="Rename"
                    style={{
                      background: 'none', border: 'none', padding: '3px', cursor: 'pointer',
                      color: 'var(--text-3)', borderRadius: '4px', flexShrink: 0,
                      display: 'flex', alignItems: 'center',
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)' }}
                  >
                    <EditIcon size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Date */}
            <div style={{ fontSize: '9px', color: 'var(--text-3)', letterSpacing: '0.3px', textAlign: 'center' }}>
              Added {formatDate(c.created_at)}
            </div>

            {/* ── Tags picker ── */}
            <div style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '6px' }}>Tags</div>
              {campaignTags.length === 0 ? (
                <div style={{ fontSize: '9px', color: 'var(--text-3)', lineHeight: 1.6, textAlign: 'center' }}>
                  Use <strong style={{ color: 'var(--text-2)' }}>TAGS</strong> to create some
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {campaignTags.map(tag => {
                    const col      = getColor(tag.color)
                    const assigned = cardTags.includes(tag.id)
                    return (
                      <button
                        key={tag.id}
                        onClick={e => { e.stopPropagation(); onToggleTag(c, tag.id) }}
                        style={{
                          padding: '4px 10px', borderRadius: '12px', cursor: 'pointer',
                          fontSize: '10px', fontWeight: 600,
                          background:  assigned ? col.bg  : 'rgba(255,255,255,0.03)',
                          border:      assigned ? `1px solid ${col.border}` : '1px solid rgba(255,255,255,0.1)',
                          color:       assigned ? col.text : 'var(--text-3)',
                          transition:  'all 0.15s',
                        }}
                      >
                        {assigned ? '✓ ' : ''}{tag.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── Delete ── */}
            <div style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: 'auto' }}>
              {!isConfirm ? (
                <button
                  onClick={() => onSetConfirm(c.id)}
                  style={{ width: '100%', padding: '6px', background: 'rgba(229,53,53,0.07)', border: '1px solid rgba(229,53,53,0.25)', borderRadius: '7px', cursor: 'pointer', color: '#e53535', fontSize: '10px', fontWeight: 700, letterSpacing: '1px', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(229,53,53,0.16)'; e.currentTarget.style.borderColor = 'rgba(229,53,53,0.5)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(229,53,53,0.07)'; e.currentTarget.style.borderColor = 'rgba(229,53,53,0.25)' }}
                >Delete</button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-2)', textAlign: 'center', lineHeight: 1.4 }}>Remove from all scenes?</div>
                  <button onClick={e => onDelete(c.id, e)} disabled={isDeleting} style={{ padding: '5px', width: '100%', background: 'rgba(229,53,53,0.15)', border: '1px solid rgba(229,53,53,0.45)', borderRadius: '6px', cursor: isDeleting ? 'wait' : 'pointer', color: '#e53535', fontSize: '10px', fontWeight: 700 }}>
                    {isDeleting ? '…' : 'Confirm'}
                  </button>
                  <button onClick={() => onSetConfirm(null)} style={{ padding: '4px', width: '100%', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-3)', fontSize: '10px' }}>Cancel</button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
})

export default function CharacterRoster({
  characters, campaignTags,
  onDelete, onAdd, onUpdateTags, onUpdateName, onCreateTag, onDeleteTag,
}: Props) {
  // Card state
  const [flippedId,  setFlippedId]  = useState<string | null>(null)
  const [confirmId,  setConfirmId]  = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // New character form
  const [addOpen,   setAddOpen]   = useState(false)
  const [newName,   setNewName]   = useState('')
  const [newFile,   setNewFile]   = useState<File | null>(null)
  const [newUrl,    setNewUrl]    = useState('')
  const [addSaving, setAddSaving] = useState(false)

  // Manage tags panel
  const [tagsOpen,    setTagsOpen]    = useState(false)
  const [newTagName,  setNewTagName]  = useState('')
  const [newTagColor, setNewTagColor] = useState('#c9a84c')
  const [tagSaving,   setTagSaving]   = useState(false)

  // Search & filter
  const [search,       setSearch]       = useState('')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())

  // Name editing
  const [editingNameId,  setEditingNameId]  = useState<string | null>(null)
  const [editingNameVal, setEditingNameVal] = useState('')
  const [nameSaving,     setNameSaving]     = useState(false)

  // ── Derived ──────────────────────────────────────────────────
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return characters.filter(c => {
      if (q && !c.name.toLowerCase().includes(q)) return false
      if (selectedTags.size > 0 && !c.tags?.some(t => selectedTags.has(t))) return false
      return true
    })
  }, [characters, search, selectedTags])

  // Lookup map so card renders are O(1) per tag instead of O(n) find()
  const tagMap = useMemo(() => {
    const m = new Map<string, CampaignTag>()
    campaignTags.forEach(t => m.set(t.id, t))
    return m
  }, [campaignTags])

  // ── Handlers ─────────────────────────────────────────────────
  const flipCard = useCallback((id: string) => {
    setFlippedId(prev => {
      if (prev === id) { setConfirmId(null); setEditingNameId(null); return null }
      setConfirmId(null)
      return id
    })
  }, [])

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingId(id)
    try {
      await onDelete(id)
      setFlippedId(null); setConfirmId(null)
    } finally {
      setDeletingId(null)
    }
  }, [onDelete])

  async function handleAdd() {
    if (!newName.trim() || (!newFile && !newUrl.trim())) return
    setAddSaving(true)
    try {
      await onAdd(newName.trim(), newFile, newUrl.trim())
      setAddOpen(false); setNewName(''); setNewFile(null); setNewUrl('')
    } finally {
      setAddSaving(false)
    }
  }

  async function handleCreateTag() {
    if (!newTagName.trim()) return
    setTagSaving(true)
    try {
      await onCreateTag(newTagName.trim(), newTagColor)
      setNewTagName('')
    } finally {
      setTagSaving(false)
    }
  }

  const toggleCharacterTag = useCallback(async (c: Character, tagId: string) => {
    const current = c.tags ?? []
    const next = current.includes(tagId) ? current.filter(t => t !== tagId) : [...current, tagId]
    await onUpdateTags(c.id, next)
  }, [onUpdateTags])

  // saveName reads editingNameVal from state; keep a ref-free callback by
  // passing the value through state-in-closure — recreate only when the value changes.
  const saveName = useCallback(async (c: Character) => {
    const name = editingNameVal.trim()
    if (!name || name === c.name) { setEditingNameId(null); return }
    setNameSaving(true)
    try {
      await onUpdateName(c.id, name)
      setEditingNameId(null)
    } finally {
      setNameSaving(false)
    }
  }, [editingNameVal, onUpdateName])

  const startEditName = useCallback((id: string, currentName: string) => {
    setEditingNameId(id)
    setEditingNameVal(currentName)
  }, [])

  const cancelEditName = useCallback(() => setEditingNameId(null), [])

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', position: 'relative' }}>

      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: [
          'radial-gradient(ellipse 55% 40% at 10% 20%, rgba(201,168,76,0.045) 0%, transparent 60%)',
          'radial-gradient(ellipse 45% 35% at 90% 80%, rgba(120,60,200,0.035) 0%, transparent 55%)',
        ].join(','),
      }} />

      <div className="cr-content" style={{ position: 'relative', zIndex: 1 }}>

        {/* ── Header ── */}
        <div className="cr-header">
          <div>
            <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: '22px', fontWeight: 600, letterSpacing: '4px', color: 'var(--text)', marginBottom: '6px', lineHeight: 1.2 }}>
              CHARACTERS
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-2)', letterSpacing: '0.3px' }}>
              {characters.length === 0
                ? 'No characters yet — create your first one.'
                : `${characters.length} character${characters.length !== 1 ? 's' : ''} · Click a card to manage`}
            </p>
          </div>

          <div className="cr-header-btns">
            <button
              onClick={() => setTagsOpen(v => !v)}
              style={{
                padding: '7px 12px', cursor: 'pointer',
                background: tagsOpen ? 'rgba(255,255,255,0.07)' : 'transparent',
                border: `1px solid ${tagsOpen ? 'rgba(255,255,255,0.2)' : 'var(--border)'}`,
                borderRadius: '8px', color: tagsOpen ? 'var(--text)' : 'var(--text-2)',
                fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px',
                display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.15s',
              }}
            >
              <svg viewBox="0 0 104 104" xmlns="http://www.w3.org/2000/svg" width="14" height="14" style={{ flexShrink: 0 }}>
                <path d="M12 12 L12 52 L52 92 Q56 96 60 92 L92 60 Q96 56 92 52 L52 12 Z" fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round"/>
                <circle cx="32" cy="32" r="6" fill="currentColor"/>
              </svg>
              TAGS {campaignTags.length > 0 && <span style={{ opacity: 0.55, fontWeight: 400 }}>({campaignTags.length})</span>}
            </button>

            <button
              onClick={() => setAddOpen(v => !v)}
              style={{
                padding: '8px 16px', cursor: 'pointer',
                background: addOpen ? 'rgba(201,168,76,0.12)' : 'rgba(201,168,76,0.07)',
                border: '1px solid rgba(201,168,76,0.35)', borderRadius: '8px',
                color: 'var(--accent)', fontSize: '11px', fontWeight: 700, letterSpacing: '1.2px',
                display: 'flex', alignItems: 'center', gap: '6px', transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,168,76,0.16)' }}
              onMouseLeave={e => { e.currentTarget.style.background = addOpen ? 'rgba(201,168,76,0.12)' : 'rgba(201,168,76,0.07)' }}
            >
              <span style={{ fontSize: '14px', lineHeight: 1 }}>+</span> NEW CHARACTER
            </button>
          </div>
        </div>

        {/* ── Manage Tags panel ── */}
        {tagsOpen && (
          <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-lt)', borderRadius: '12px', padding: '18px 20px', marginBottom: '20px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '14px' }}>
              Campaign Tags
            </div>

            {campaignTags.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                {campaignTags.map(tag => {
                  const col = getColor(tag.color)
                  return (
                    <span key={tag.id} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '4px 10px 4px 12px', borderRadius: '20px',
                      fontSize: '11px', fontWeight: 600,
                      background: col.bg, border: `1px solid ${col.border}`, color: col.text,
                    }}>
                      {tag.name}
                      <button
                        onClick={() => onDeleteTag(tag.id)}
                        style={{ background: 'none', border: 'none', padding: '0 1px', cursor: 'pointer', color: col.text, fontSize: '13px', lineHeight: 1, opacity: 0.6 }}
                      >×</button>
                    </span>
                  )
                })}
              </div>
            ) : (
              <p style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '14px' }}>No tags yet — create one below.</p>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <input
                className="finput"
                placeholder="Tag name…"
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateTag() }}
                style={{ flex: '1 1 140px', fontSize: '12px', padding: '6px 10px' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '30px', height: '30px', borderRadius: '8px', overflow: 'hidden',
                  border: '1px solid var(--border-lt)', flexShrink: 0, position: 'relative',
                  background: newTagColor,
                }}>
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={e => setNewTagColor(e.target.value)}
                    style={{ position: 'absolute', inset: '-4px', width: 'calc(100% + 8px)', height: 'calc(100% + 8px)', opacity: 0, cursor: 'pointer' }}
                    title="Pick tag colour"
                  />
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>{newTagColor}</span>
              </div>
              <button
                className="btn btn-red btn-sm"
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || tagSaving}
              >
                {tagSaving ? '…' : '+ Add'}
              </button>
            </div>
          </div>
        )}

        {/* ── Search + filter chips ── */}
        {characters.length > 0 && (
          <div style={{ marginBottom: '28px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: 'var(--text-3)', pointerEvents: 'none' }}>⌕</span>
              <input
                className="finput"
                placeholder="Search characters…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ fontSize: '12px', padding: '8px 32px 8px 30px' }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '14px', lineHeight: 1, padding: '2px' }}>×</button>
              )}
            </div>

            {campaignTags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.5px', textTransform: 'uppercase', marginRight: '2px' }}>Filter:</span>
                {campaignTags.map(tag => {
                  const col    = getColor(tag.color)
                  const active = selectedTags.has(tag.id)
                  return (
                    <button
                      key={tag.id}
                      onClick={() => setSelectedTags(prev => { const n = new Set(prev); active ? n.delete(tag.id) : n.add(tag.id); return n })}
                      style={{
                        padding: '3px 10px', borderRadius: '20px', cursor: 'pointer',
                        fontSize: '10px', fontWeight: 600, letterSpacing: '0.4px',
                        background: active ? col.bg  : 'rgba(255,255,255,0.04)',
                        border:     active ? `1px solid ${col.border}` : '1px solid rgba(255,255,255,0.1)',
                        color:      active ? col.text : 'rgba(255,255,255,0.9)',
                        transition: 'all 0.15s',
                        boxShadow:  active ? `0 0 8px ${col.border}` : 'none',
                      }}
                    >
                      {tag.name}
                    </button>
                  )
                })}
                {selectedTags.size > 0 && (
                  <button onClick={() => setSelectedTags(new Set())} style={{ padding: '3px 8px', borderRadius: '20px', cursor: 'pointer', fontSize: '10px', color: 'var(--text-3)', background: 'transparent', border: '1px solid var(--border)' }}>
                    clear
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Add Character Form ── */}
        {addOpen && (
          <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-lt)', borderRadius: '12px', padding: '20px', marginBottom: '32px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '14px' }}>New Character</div>
            <input className="finput" placeholder="Character name" value={newName} onChange={e => setNewName(e.target.value)} style={{ fontSize: '12px', padding: '7px 10px', marginBottom: '12px' }} />
            <UploadZone accept="image/*" label="Drop character art here" icon="🧑" hint="PNG with transparency recommended — tall portrait works best" onFile={f => setNewFile(f)} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '10px 0', color: 'var(--text-3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.8px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />or paste a URL<div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>
            <input className="finput" placeholder="https://… image URL" value={newUrl} onChange={e => setNewUrl(e.target.value)} style={{ fontSize: '12px', padding: '7px 10px' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setAddOpen(false); setNewName(''); setNewFile(null); setNewUrl('') }}>Cancel</button>
              <button className="btn btn-red btn-sm" onClick={handleAdd} disabled={!newName.trim() || (!newFile && !newUrl.trim()) || addSaving}>
                {addSaving ? 'Creating…' : 'Create Character'}
              </button>
            </div>
          </div>
        )}

        {/* ── Grid ── */}
        {visible.length > 0 && (
          <div className="cr-grid">
            {visible.map(c => {
              const isEditingThis = editingNameId === c.id
              return (
                <CharacterCard
                  key={c.id}
                  c={c}
                  campaignTags={campaignTags}
                  tagMap={tagMap}
                  isFlipped={flippedId === c.id}
                  isConfirm={confirmId === c.id}
                  isDeleting={deletingId === c.id}
                  isEditingName={isEditingThis}
                  editingNameVal={isEditingThis ? editingNameVal : ''}
                  nameSaving={isEditingThis && nameSaving}
                  onFlip={flipCard}
                  onSetConfirm={setConfirmId}
                  onDelete={handleDelete}
                  onStartEditName={startEditName}
                  onChangeEditName={setEditingNameVal}
                  onCancelEditName={cancelEditName}
                  onSaveName={saveName}
                  onToggleTag={toggleCharacterTag}
                />
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
          transform: scale(1.05) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
          box-shadow: 0 28px 52px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06);
        }
        .rf-inner {
          transform-style: preserve-3d;
          transition: transform 0.52s cubic-bezier(.22,1,.36,1);
        }
        .rf-inner.rf-flipped { transform: rotateY(180deg); }
        .rf-face { -webkit-backface-visibility: hidden; backface-visibility: hidden; }
        .rf-back { transform: rotateY(180deg); }
      `}</style>
    </div>
  )
}
