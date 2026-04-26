'use client'

import { memo, useCallback, useRef, useState } from 'react'
import Image from 'next/image'
import type { Campaign } from '@/lib/types'
import { thumbUrl } from '@/lib/supabase/storage'
import AppIcon from '@/components/AppIcon'

interface Props {
  campaigns:           Campaign[]
  onSelect:            (id: string) => void
  onNew:               () => void
  onUpdateCover:       (campId: string, file: File) => Promise<void>
  onUpdateName:        (campId: string, name: string) => Promise<void>
  onUpdateDescription: (campId: string, description: string) => Promise<void>
  onDelete:            (campId: string) => Promise<void>
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface Accent { border: string; glow: string; badge: string }

const CARD_ACCENTS: Accent[] = [
  { border: 'rgba(201,168,76,',  glow: 'rgba(201,168,76,',  badge: 'rgba(201,168,76,' },  // gold
  { border: 'rgba(139,159,232,', glow: 'rgba(139,159,232,', badge: 'rgba(139,159,232,' }, // blue
  { border: 'rgba(53,200,140,',  glow: 'rgba(53,200,140,',  badge: 'rgba(53,200,140,' },  // teal
  { border: 'rgba(229,160,53,',  glow: 'rgba(229,160,53,',  badge: 'rgba(229,160,53,' },  // amber
  { border: 'rgba(160,80,255,',  glow: 'rgba(160,80,255,',  badge: 'rgba(160,80,255,' },  // purple
]

interface CampaignCardProps {
  campaign:       Campaign
  accent:         Accent
  animationDelay: string
  isHovered:      boolean
  isTouchDevice:  boolean
  onSelect:       (id: string) => void
  onHover:        (id: string | null) => void
  onOpenSettings: (campaign: Campaign, e: React.MouseEvent) => void
}

const CampaignCard = memo(function CampaignCard({
  campaign: c, accent, animationDelay, isHovered: isHov, isTouchDevice,
  onSelect, onHover, onOpenSettings,
}: CampaignCardProps) {
  const hasCover = !!c.cover_signed_url
  return (
    <div
      onClick={() => onSelect(c.id)}
      onMouseEnter={() => !isTouchDevice && onHover(c.id)}
      onMouseLeave={() => !isTouchDevice && onHover(null)}
      style={{
        background: 'var(--bg-panel)',
        border: `1px solid ${isHov ? `${accent.border}0.42)` : 'var(--border)'}`,
        borderRadius: '14px',
        cursor: 'pointer',
        transition: 'transform 0.22s cubic-bezier(.22,1,.36,1), box-shadow 0.22s ease, border-color 0.18s ease',
        transform: isHov ? 'translateY(-4px) scale(1.005)' : 'translateY(0) scale(1)',
        boxShadow: isHov ? `0 16px 48px rgba(0,0,0,0.45), 0 4px 16px ${accent.glow}0.14)` : '0 2px 10px rgba(0,0,0,0.22)',
        animation: `homeCardIn 0.5s cubic-bezier(.22,1,.36,1) ${animationDelay} both`,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: `linear-gradient(90deg, transparent, ${accent.border}${isHov ? '0.85)' : '0.3)'}, transparent)`,
        transition: 'all 0.2s ease', zIndex: 1,
      }} />

      {/* Settings gear button */}
      <button
        onClick={e => onOpenSettings(c, e)}
        title="Campaign settings"
        style={{
          position: 'absolute', top: '8px', right: '8px', zIndex: 3,
          width: '28px', height: '28px', borderRadius: '7px',
          background: 'rgba(0,0,0,0.52)', border: '1px solid rgba(255,255,255,0.14)',
          color: 'rgba(255,255,255,0.65)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)', transition: 'background 0.15s ease, color 0.15s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.75)'; e.currentTarget.style.color = '#fff' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.52)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492M5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0"/>
          <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115z"/>
        </svg>
      </button>

      {/* Cover image area */}
      <div style={{
        position: 'relative', width: '100%', height: '140px',
        background: hasCover ? 'transparent' : `linear-gradient(135deg, ${accent.badge}0.12) 0%, var(--bg-raised) 100%)`,
        overflow: 'hidden',
      }}>
        {hasCover ? (
          <Image
            src={thumbUrl(c.cover_signed_url!, 600)}
            alt={c.name}
            fill
            sizes="(max-width: 600px) 50vw, (max-width: 1024px) 33vw, 280px"
            style={{ objectFit: 'cover', transition: 'transform 0.3s ease', transform: isHov ? 'scale(1.04)' : 'scale(1)' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AppIcon size={40} opacity={0.2} />
          </div>
        )}
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
})

export default function CampaignHome({ campaigns, onSelect, onNew, onUpdateCover, onUpdateName, onUpdateDescription, onDelete }: Props) {
  const [hoveredId,  setHoveredId]  = useState<string | null>(null)
  const [hoveredNew, setHoveredNew] = useState(false)
  const [isTouchDevice] = useState(() =>
    typeof window !== 'undefined' && navigator.maxTouchPoints > 0
  )

  // Settings modal state
  const [settingsId,    setSettingsId]    = useState<string | null>(null)
  const [editName,        setEditName]        = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [savingName,      setSavingName]      = useState(false)
  const [savingDesc,      setSavingDesc]      = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [deleting,      setDeleting]      = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const settingsCamp = settingsId ? campaigns.find(c => c.id === settingsId) ?? null : null

  const openSettings = useCallback((c: Campaign, e: React.MouseEvent) => {
    e.stopPropagation()
    setSettingsId(c.id)
    setEditName(c.name)
    setEditDescription(c.description ?? '')
    setConfirmDelete(false)
  }, [])

  function closeSettings() {
    setSettingsId(null)
    setConfirmDelete(false)
  }

  async function saveName() {
    if (!settingsId || !editName.trim()) return
    setSavingName(true)
    try { await onUpdateName(settingsId, editName.trim()) } finally { setSavingName(false) }
  }

  async function saveDescription() {
    if (!settingsId) return
    setSavingDesc(true)
    try { await onUpdateDescription(settingsId, editDescription) } finally { setSavingDesc(false) }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !settingsId) return
    e.target.value = ''
    setUploadingCover(true)
    try { await onUpdateCover(settingsId, file) } finally { setUploadingCover(false) }
  }

  async function handleDelete() {
    if (!settingsId) return
    setDeleting(true)
    try { await onDelete(settingsId); closeSettings() } finally { setDeleting(false) }
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
          'radial-gradient(ellipse 60% 40% at 15% 25%, rgba(201,168,76,0.055) 0%, transparent 60%)',
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

      {/* Hidden file input for cover upload in modal */}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* Scrollable content */}
      <div style={{ position: 'relative', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div className="ch-content">

          {/* Hero header */}
          <div style={{ marginBottom: '52px', animation: 'homeIn 0.55s cubic-bezier(.22,1,.36,1) both' }}>
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

            {campaigns.map((c, i) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                accent={CARD_ACCENTS[i % CARD_ACCENTS.length]}
                animationDelay={`${i * 0.055}s`}
                isHovered={hoveredId === c.id}
                isTouchDevice={isTouchDevice}
                onSelect={onSelect}
                onHover={setHoveredId}
                onOpenSettings={openSettings}
              />
            ))}

            {/* New Campaign card */}
            <div
              onClick={onNew}
              onMouseEnter={() => !isTouchDevice && setHoveredNew(true)}
              onMouseLeave={() => !isTouchDevice && setHoveredNew(false)}
              style={{
                border: `1px dashed ${hoveredNew ? 'rgba(201,168,76,0.5)' : 'var(--border-lt)'}`,
                borderRadius: '14px',
                cursor: 'pointer',
                transition: 'transform 0.22s cubic-bezier(.22,1,.36,1), box-shadow 0.22s ease, background 0.18s ease, border-color 0.18s ease',
                transform: hoveredNew ? 'translateY(-4px) scale(1.005)' : 'translateY(0) scale(1)',
                background: hoveredNew ? 'rgba(201,168,76,0.04)' : 'transparent',
                boxShadow: hoveredNew ? '0 10px 32px rgba(201,168,76,0.09)' : 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                minHeight: '220px', textAlign: 'center',
                animation: `homeCardIn 0.5s cubic-bezier(.22,1,.36,1) ${campaigns.length * 0.055}s both`,
              }}
            >
              <div style={{
                width: '46px', height: '46px', borderRadius: '50%',
                border: `1.5px dashed ${hoveredNew ? 'rgba(201,168,76,0.55)' : 'var(--border-lt)'}`,
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
              <div style={{ marginBottom: '16px' }}><AppIcon size={52} opacity={0.12} /></div>
              <p style={{ fontSize: '11px', color: 'var(--text-3)', letterSpacing: '0.3px', lineHeight: 1.8 }}>
                Your campaigns will appear here.<br />Start by creating one above.
              </p>
            </div>
          )}

        </div>
      </div>

      {/* Settings modal */}
      {settingsCamp && (
        <div
          onClick={closeSettings}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-panel)', border: '1px solid var(--border)',
              borderRadius: '16px', width: '360px', padding: '28px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
              display: 'flex', flexDirection: 'column', gap: '20px',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: '13px', fontWeight: 600, letterSpacing: '2px', color: 'var(--text)' }}>
                CAMPAIGN SETTINGS
              </div>
              <button
                onClick={closeSettings}
                style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '2px 4px' }}
              >
                ×
              </button>
            </div>

            {/* Name field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-2)' }}>
                Name
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveName()}
                  style={{
                    flex: 1, background: 'var(--bg-raised)', border: '1px solid var(--border)',
                    borderRadius: '8px', padding: '8px 11px', color: 'var(--text)',
                    fontFamily: 'Inter, sans-serif', fontSize: '13px', outline: 'none',
                  }}
                />
                <button
                  onClick={saveName}
                  disabled={savingName || !editName.trim() || editName.trim() === settingsCamp.name}
                  className="btn btn-outline btn-sm"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {savingName ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            {/* Description field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-2)' }}>
                Description
              </label>
              <textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                rows={3}
                style={{
                  background: 'var(--bg-raised)', border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '8px 11px', color: 'var(--text)',
                  fontFamily: 'Inter, sans-serif', fontSize: '13px', outline: 'none',
                  resize: 'vertical', lineHeight: 1.5,
                }}
              />
              <button
                onClick={saveDescription}
                disabled={savingDesc || editDescription === (settingsCamp.description ?? '')}
                className="btn btn-outline btn-sm"
                style={{ alignSelf: 'flex-end' }}
              >
                {savingDesc ? 'Saving…' : 'Save'}
              </button>
            </div>

            {/* Cover image */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-2)' }}>
                Cover Image
              </label>
              {settingsCamp.cover_signed_url && (
                <div style={{ position: 'relative', width: '100%', height: '120px', borderRadius: '8px', overflow: 'hidden', marginBottom: '4px' }}>
                  <Image
                    src={settingsCamp.cover_signed_url}
                    alt=""
                    fill
                    sizes="400px"
                    style={{ objectFit: 'cover' }}
                  />
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingCover}
                className="btn btn-outline btn-sm"
              >
                {uploadingCover ? 'Uploading…' : settingsCamp.cover_signed_url ? 'Change Cover' : 'Add Cover'}
              </button>
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'var(--border)' }} />

            {/* Delete */}
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{
                  background: 'rgba(229,53,53,0.08)', border: '1px solid rgba(229,53,53,0.3)',
                  borderRadius: '8px', padding: '9px', cursor: 'pointer',
                  color: '#e53535', fontSize: '12px', fontWeight: 600, letterSpacing: '0.5px',
                }}
              >
                Delete Campaign
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-2)', textAlign: 'center' }}>
                  This will permanently delete all scenes, characters, and media.
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="btn btn-ghost btn-sm"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    style={{
                      flex: 1, background: 'rgba(229,53,53,0.15)', border: '1px solid rgba(229,53,53,0.5)',
                      borderRadius: '7px', padding: '7px', cursor: deleting ? 'wait' : 'pointer',
                      color: '#e53535', fontSize: '12px', fontWeight: 700,
                    }}
                  >
                    {deleting ? 'Deleting…' : 'Confirm Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes homeIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes homeCardIn {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ch-content {
          max-width: 1120px; margin: 0 auto;
          padding: 56px 48px 80px; width: 100%;
        }
        @media (max-width: 640px) {
          .ch-content { padding: 32px 20px 60px; }
        }
        @media (max-width: 900px) and (min-width: 641px) {
          .ch-content { padding: 40px 32px 72px; }
        }
      `}</style>
    </div>
  )
}
