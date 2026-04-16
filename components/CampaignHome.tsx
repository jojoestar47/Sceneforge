'use client'

import { useRef, useState } from 'react'
import type { Campaign } from '@/lib/types'

interface Props {
  campaigns:     Campaign[]
  onSelect:      (id: string) => void
  onNew:         () => void
  onUpdateCover: (campId: string, file: File) => Promise<void>
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const CARD_ACCENTS = [
  { border: 'rgba(229,53,53,',   glow: 'rgba(229,53,53,',   badge: 'rgba(229,53,53,' },
  { border: 'rgba(160,80,255,',  glow: 'rgba(160,80,255,',  badge: 'rgba(160,80,255,' },
  { border: 'rgba(53,148,229,',  glow: 'rgba(53,148,229,',  badge: 'rgba(53,148,229,' },
  { border: 'rgba(229,160,53,',  glow: 'rgba(229,160,53,',  badge: 'rgba(229,160,53,' },
  { border: 'rgba(53,200,140,',  glow: 'rgba(53,200,140,',  badge: 'rgba(53,200,140,' },
]

export default function CampaignHome({ campaigns, onSelect, onNew, onUpdateCover }: Props) {
  const [hoveredId,    setHoveredId]    = useState<string | null>(null)
  const [hoveredNew,   setHoveredNew]   = useState(false)
  const [uploadingId,  setUploadingId]  = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingCampId = useRef<string | null>(null)

  function openFilePicker(campId: string, e: React.MouseEvent) {
    e.stopPropagation()
    pendingCampId.current = campId
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const campId = pendingCampId.current
    if (!file || !campId) return
    e.target.value = ''
    setUploadingId(campId)
    try { await onUpdateCover(campId, file) } finally { setUploadingId(null) }
  }

  return (
    <div style={{
      flex: 1, background: 'var(--bg)', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', position: 'relative',
    }}>
      {/* Ambient background */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: [
          'radial-gradient(ellipse 60% 40% at 15% 25%, rgba(229,53,53,0.055) 0%, transparent 60%)',
          'radial-gradient(ellipse 50% 35% at 85% 75%, rgba(120,60,200,0.04) 0%, transparent 55%)',
          'radial-gradient(ellipse 70% 50% at 50% 100%, rgba(0,0,0,0.5) 0%, transparent 70%)',
        ].join(','),
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)`,
        backgroundSize: '52px 52px',
      }} />

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* Scrollable content */}
      <div style={{ position: 'relative', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '56px 48px 80px', width: '100%' }}>

          {/* Hero header */}
          <div style={{ marginBottom: '52px', animation: 'homeIn 0.55s cubic-bezier(.22,1,.36,1) both' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(229,53,53,0.08)', border: '1px solid rgba(229,53,53,0.2)',
              borderRadius: '20px', padding: '4px 12px 4px 8px', marginBottom: '20px',
            }}>
              <span style={{ fontSize: '14px' }}>🎭</span>
              <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--accent)' }}>
                SceneForge
              </span>
            </div>
            <h1 style={{ fontFamily: "'Cinzel', serif", fontSize: '30px', fontWeight: 600, letterSpacing: '4px', color: 'var(--text)', marginBottom: '10px', lineHeight: 1.2 }}>
              YOUR CAMPAIGNS
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-2)', letterSpacing: '0.3px', lineHeight: 1.7 }}>
              {campaigns.length === 0
                ? 'No campaigns yet — create one to begin your adventure.'
                : `${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''} · Select one to continue.`}
            </p>
          </div>

          {/* Campaign grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '18px' }}>

            {campaigns.map((c, i) => {
              const isHov     = hoveredId === c.id
              const isUploading = uploadingId === c.id
              const accent    = CARD_ACCENTS[i % CARD_ACCENTS.length]
              const hasCover  = !!c.cover_signed_url
              const delay     = `${i * 0.055}s`

              return (
                <div
                  key={c.id}
                  onClick={() => !isUploading && onSelect(c.id)}
                  onMouseEnter={() => setHoveredId(c.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    background: 'var(--bg-panel)',
                    border: `1px solid ${isHov ? `${accent.border}0.42)` : 'var(--border)'}`,
                    borderRadius: '14px',
                    cursor: isUploading ? 'wait' : 'pointer',
                    transition: 'transform 0.22s cubic-bezier(.22,1,.36,1), box-shadow 0.22s ease, border-color 0.18s ease',
                    transform: isHov && !isUploading ? 'translateY(-4px) scale(1.005)' : 'translateY(0) scale(1)',
                    boxShadow: isHov ? `0 16px 48px rgba(0,0,0,0.45), 0 4px 16px ${accent.glow}0.14)` : '0 2px 10px rgba(0,0,0,0.22)',
                    animation: `homeCardIn 0.5s cubic-bezier(.22,1,.36,1) ${delay} both`,
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  {/* Top accent line (always visible, brightens on hover) */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                    background: `linear-gradient(90deg, transparent, ${accent.border}${isHov ? '0.85)' : '0.3)'}, transparent)`,
                    transition: 'all 0.2s ease', zIndex: 1,
                  }} />

                  {/* Cover image area */}
                  <div style={{
                    position: 'relative', width: '100%', height: '140px',
                    background: hasCover ? 'transparent' : `linear-gradient(135deg, ${accent.badge}0.12) 0%, var(--bg-raised) 100%)`,
                    overflow: 'hidden',
                  }}>
                    {hasCover ? (
                      <img
                        src={c.cover_signed_url}
                        alt={c.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.3s ease', transform: isHov ? 'scale(1.04)' : 'scale(1)' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '36px', opacity: 0.25 }}>🎭</span>
                      </div>
                    )}

                    {/* Cover overlay on hover: upload / change button */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: isHov ? 'rgba(0,0,0,0.45)' : 'transparent',
                      transition: 'background 0.2s ease',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: '8px',
                    }}>
                      {isUploading ? (
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.8)', fontWeight: 600, letterSpacing: '1px' }}>
                          Uploading…
                        </div>
                      ) : isHov ? (
                        <button
                          onClick={e => openFilePicker(c.id, e)}
                          style={{
                            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)',
                            borderRadius: '8px', padding: '6px 12px', cursor: 'pointer',
                            color: '#fff', fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
                            backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', gap: '6px',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
                        >
                          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                            <path d="M4 1.5H3A1.5 1.5 0 001.5 3v5A1.5 1.5 0 003 9.5h5A1.5 1.5 0 009.5 8V7M7 1.5l1.5 1.5L5.5 6H4V4.5L7 1.5z" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          {hasCover ? 'Change Cover' : 'Add Cover'}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Card body */}
                  <div style={{ padding: '18px 20px 16px' }}>
                    <div style={{
                      fontFamily: "'Cinzel', serif", fontSize: '13px', fontWeight: 600,
                      letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text)',
                      marginBottom: '5px', lineHeight: 1.4,
                    }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.3px' }}>
                      Created {formatDate(c.created_at)}
                    </div>

                    {/* CTA on hover */}
                    <div style={{
                      overflow: 'hidden', maxHeight: isHov ? '24px' : '0',
                      opacity: isHov ? 1 : 0, marginTop: isHov ? '12px' : '0',
                      transition: 'max-height 0.22s ease, opacity 0.18s ease, margin 0.22s ease',
                    }}>
                      <div style={{
                        fontSize: '10px', fontWeight: 700, letterSpacing: '1.8px', textTransform: 'uppercase',
                        color: `${accent.border}0.9)`,
                        display: 'flex', alignItems: 'center', gap: '5px',
                      }}>
                        Open Campaign
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5h6M5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* New Campaign card */}
            <div
              onClick={onNew}
              onMouseEnter={() => setHoveredNew(true)}
              onMouseLeave={() => setHoveredNew(false)}
              style={{
                border: `1px dashed ${hoveredNew ? 'rgba(229,53,53,0.5)' : 'var(--border-lt)'}`,
                borderRadius: '14px',
                cursor: 'pointer',
                transition: 'transform 0.22s cubic-bezier(.22,1,.36,1), box-shadow 0.22s ease, background 0.18s ease, border-color 0.18s ease',
                transform: hoveredNew ? 'translateY(-4px) scale(1.005)' : 'translateY(0) scale(1)',
                background: hoveredNew ? 'rgba(229,53,53,0.04)' : 'transparent',
                boxShadow: hoveredNew ? '0 10px 32px rgba(229,53,53,0.09)' : 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                minHeight: '220px', textAlign: 'center',
                animation: `homeCardIn 0.5s cubic-bezier(.22,1,.36,1) ${campaigns.length * 0.055}s both`,
              }}
            >
              <div style={{
                width: '46px', height: '46px', borderRadius: '50%',
                border: `1.5px dashed ${hoveredNew ? 'rgba(229,53,53,0.55)' : 'var(--border-lt)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: hoveredNew ? 'var(--accent)' : 'var(--text-3)',
                fontSize: '22px', fontWeight: 300, marginBottom: '12px',
                transition: 'all 0.22s ease',
                transform: hoveredNew ? 'scale(1.12) rotate(90deg)' : 'scale(1) rotate(0deg)',
              }}>
                +
              </div>
              <div style={{
                fontSize: '10px', fontWeight: 700, letterSpacing: '1.8px', textTransform: 'uppercase',
                color: hoveredNew ? 'var(--accent)' : 'var(--text-3)',
                transition: 'color 0.18s ease',
              }}>
                New Campaign
              </div>
            </div>

          </div>

          {/* Empty state extra hint */}
          {campaigns.length === 0 && (
            <div style={{ marginTop: '60px', textAlign: 'center', animation: 'homeIn 0.6s cubic-bezier(.22,1,.36,1) 0.15s both' }}>
              <div style={{ fontSize: '48px', opacity: 0.12, marginBottom: '16px' }}>🎭</div>
              <p style={{ fontSize: '11px', color: 'var(--text-3)', letterSpacing: '0.3px', lineHeight: 1.8 }}>
                Your campaigns will appear here.<br />Start by creating one above.
              </p>
            </div>
          )}

        </div>
      </div>

      <style>{`
        @keyframes homeIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes homeCardIn {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
