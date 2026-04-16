'use client'

import { useState } from 'react'
import type { Scene } from '@/lib/types'

interface Props {
  scenes:        Scene[]
  activeSceneId: string | null
  hasCampaign:   boolean
  onSelect:      (id: string) => void
  onDelete:      (id: string) => void
  onEdit:        (id: string) => void
  onAdd:         () => void
  onReorder?:    (dragId: string, targetId: string) => void
}

function mediaUrl(m: Scene['bg']): string | null {
  if (!m) return null
  return m.signed_url || m.url || null
}

export default function SceneList({
  scenes, activeSceneId, hasCampaign,
  onSelect, onDelete, onEdit, onAdd, onReorder,
}: Props) {
  const [q,          setQ]          = useState('')
  const [dragId,     setDragId]     = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [hoveredId,  setHoveredId]  = useState<string | null>(null)
  const [isTouchDevice] = useState(() =>
    typeof window !== 'undefined' && navigator.maxTouchPoints > 0
  )

  const filtered = scenes.filter(s => !q || s.name.toLowerCase().includes(q.toLowerCase()))
  const canDrag  = !q && !!onReorder && !isTouchDevice

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* ── Search bar ── */}
      <div style={{ padding: '10px 10px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
            style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }}>
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M8 8l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <input
            className="finput"
            style={{ padding: '6px 28px 6px 28px', fontSize: '11px' }}
            placeholder="Search scenes…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          {q && (
            <button onClick={() => setQ('')} style={{
              position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer',
              padding: '2px', fontSize: '11px', lineHeight: 1, display: 'flex',
            }}>✕</button>
          )}
        </div>
      </div>

      {/* ── List ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>

        {/* Empty states */}
        {!hasCampaign && (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: '11px', letterSpacing: '0.3px' }}>
            No campaign selected
          </div>
        )}
        {hasCampaign && !filtered.length && (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: '11px', letterSpacing: '0.3px' }}>
            {q ? 'No scenes match' : 'No scenes yet'}
          </div>
        )}

        {filtered.map(sc => {
          const active     = sc.id === activeSceneId
          const bgUrl      = mediaUrl(sc.bg)
          const musicN     = (sc.tracks || []).filter(t => t.kind === 'music' || t.kind === 'ml2' || t.kind === 'ml3').length
          const ambN       = (sc.tracks || []).filter(t => t.kind === 'ambience').length
          const isDragging = sc.id === dragId
          const isOver     = sc.id === dragOverId && sc.id !== dragId
          const isHov      = hoveredId === sc.id
          const num        = scenes.indexOf(sc) + 1

          return (
            <div
              key={sc.id}
              draggable={canDrag}
              onDragStart={canDrag ? e => { setDragId(sc.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', sc.id) } : undefined}
              onDragOver={canDrag ? e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (sc.id !== dragId) setDragOverId(sc.id) } : undefined}
              onDragLeave={canDrag ? () => setDragOverId(p => p === sc.id ? null : p) : undefined}
              onDrop={canDrag ? e => { e.preventDefault(); if (dragId && dragId !== sc.id && onReorder) onReorder(dragId, sc.id); setDragId(null); setDragOverId(null) } : undefined}
              onDragEnd={canDrag ? () => { setDragId(null); setDragOverId(null) } : undefined}
              onClick={() => onSelect(sc.id)}
              onDoubleClick={() => onEdit(sc.id)}
              onMouseEnter={() => setHoveredId(sc.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'flex', alignItems: 'stretch',
                margin: '3px 8px',
                height: '72px',
                borderRadius: '10px',
                cursor: canDrag ? 'grab' : 'pointer',
                position: 'relative', overflow: 'hidden',
                background: active ? 'rgba(229,53,53,0.07)' : isHov ? 'var(--bg-hover)' : 'var(--bg-raised)',
                border: `1px solid ${active ? 'rgba(229,53,53,0.32)' : isOver ? 'var(--accent)' : isHov ? 'var(--border-lt)' : 'var(--border)'}`,
                boxShadow: active ? 'inset 3px 0 0 var(--accent)' : 'none',
                opacity: isDragging ? 0.3 : 1,
                transition: 'background 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease, opacity 0.14s ease',
              }}
            >
              {/* Drag handle */}
              {canDrag && (
                <div style={{
                  width: '16px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isHov ? 'var(--text-3)' : 'transparent',
                  fontSize: '10px', userSelect: 'none', WebkitUserSelect: 'none',
                  transition: 'color 0.14s ease',
                }}>⠿</div>
              )}

              {/* Thumbnail */}
              <div style={{
                width: '86px', flexShrink: 0, background: 'var(--bg)',
                overflow: 'hidden', display: 'flex', alignItems: 'center',
                justifyContent: 'center', position: 'relative',
              }}>
                {bgUrl
                  ? sc.bg?.type === 'video'
                    ? <video src={bgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline preload="metadata" />
                    : <img src={bgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease', transform: isHov ? 'scale(1.07)' : 'scale(1)' }} />
                  : <span style={{ fontSize: '20px', opacity: 0.2 }}>🎭</span>
                }
                {/* Order number */}
                <div style={{
                  position: 'absolute', bottom: '4px', left: '5px',
                  background: 'rgba(0,0,0,0.6)', borderRadius: '4px',
                  padding: '1px 5px', fontSize: '9px', fontWeight: 700,
                  color: 'rgba(255,255,255,0.65)', letterSpacing: '0.3px',
                }}>
                  {String(num).padStart(2, '0')}
                </div>
              </div>

              {/* Body */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 8px 0 10px', overflow: 'hidden', minWidth: 0 }}>
                <div style={{
                  fontSize: '12px', fontWeight: 600, color: 'var(--text)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  marginBottom: '5px', lineHeight: 1.2,
                }}>
                  {sc.name}
                </div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', overflow: 'hidden' }}>
                  {active && (
                    <span style={{
                      fontSize: '8px', fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase',
                      color: 'var(--accent)', background: 'rgba(229,53,53,0.15)',
                      borderRadius: '4px', padding: '2px 5px', flexShrink: 0,
                    }}>ON</span>
                  )}
                  {musicN > 0 && (
                    <span style={{ fontSize: '9px', color: 'var(--text-3)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '1px 5px', flexShrink: 0 }}>
                      ♪ {musicN}
                    </span>
                  )}
                  {ambN > 0 && (
                    <span style={{ fontSize: '9px', color: 'var(--text-3)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '1px 5px', flexShrink: 0 }}>
                      ~ {ambN}
                    </span>
                  )}
                  {sc.location && (
                    <span style={{ fontSize: '9px', color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {sc.location}
                    </span>
                  )}
                </div>
              </div>

              {/* Hover actions */}
              <div style={{
                display: 'flex', flexDirection: 'column', gap: '4px',
                padding: '8px 7px', flexShrink: 0, justifyContent: 'center',
                opacity: isHov || isTouchDevice ? 1 : 0,
                transition: 'opacity 0.14s ease',
              }}>
                <button
                  onClick={e => { e.stopPropagation(); onEdit(sc.id) }}
                  title="Edit scene"
                  style={{
                    width: '26px', height: '26px', borderRadius: '6px',
                    background: 'var(--bg-panel)', border: '1px solid var(--border)',
                    color: 'var(--text-2)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.12s ease', flexShrink: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-lt)'; e.currentTarget.style.color = 'var(--text)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-panel)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)' }}
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M7.5 1.5l2 2L3 10H1V8L7.5 1.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round"/>
                  </svg>
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onDelete(sc.id) }}
                  onTouchEnd={e => { e.preventDefault(); e.stopPropagation(); onDelete(sc.id) }}
                  title="Delete scene"
                  style={{
                    width: '26px', height: '26px', borderRadius: '6px',
                    background: 'var(--bg-panel)', border: '1px solid var(--border)',
                    color: 'var(--text-3)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.12s ease', flexShrink: 0,
                    touchAction: 'manipulation',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(229,53,53,0.1)'; e.currentTarget.style.borderColor = 'rgba(229,53,53,0.35)'; e.currentTarget.style.color = 'var(--accent)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-panel)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-3)' }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 2.5h7M3.5 2.5V1.5h3v1M4 2.5l.4 6h1.2l.4-6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          )
        })}

        {/* ── Add Scene button ── */}
        {hasCampaign && (
          <div style={{ margin: '6px 8px 8px' }}>
            <AddSceneButton onClick={onAdd} />
          </div>
        )}
      </div>

      <style>{`
        @keyframes sceneIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

function AddSceneButton({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', height: '52px', borderRadius: '10px',
        border: `1px dashed ${hov ? 'rgba(229,53,53,0.5)' : 'var(--border-lt)'}`,
        background: hov ? 'rgba(229,53,53,0.04)' : 'transparent',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
        color: hov ? 'var(--accent)' : 'var(--text-3)',
        fontSize: '11px', fontWeight: 600, letterSpacing: '0.4px',
        transition: 'all 0.15s ease',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M7 4.5v5M4.5 7h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
      New Scene
    </button>
  )
}
