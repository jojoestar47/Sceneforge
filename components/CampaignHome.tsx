'use client'

import { useState } from 'react'
import type { Campaign } from '@/lib/types'

interface Props {
  campaigns: Campaign[]
  onSelect:  (id: string) => void
  onNew:     () => void
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Deterministic accent color per campaign (subtle variation)
const CARD_ACCENTS = [
  'rgba(229,53,53,',
  'rgba(180,80,255,',
  'rgba(53,148,229,',
  'rgba(229,160,53,',
  'rgba(53,229,140,',
]

function cardAccent(index: number) {
  return CARD_ACCENTS[index % CARD_ACCENTS.length]
}

export default function CampaignHome({ campaigns, onSelect, onNew }: Props) {
  const [hoveredId,  setHoveredId]  = useState<string | null>(null)
  const [hoveredNew, setHoveredNew] = useState(false)

  return (
    <div style={{
      flex: 1,
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* ── Ambient background ── */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: [
          'radial-gradient(ellipse 60% 40% at 15% 25%, rgba(229,53,53,0.055) 0%, transparent 60%)',
          'radial-gradient(ellipse 50% 35% at 85% 75%, rgba(120,60,200,0.04) 0%, transparent 55%)',
          'radial-gradient(ellipse 70% 50% at 50% 100%, rgba(0,0,0,0.5) 0%, transparent 70%)',
        ].join(','),
      }} />

      {/* Subtle grid texture */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)`,
        backgroundSize: '52px 52px',
      }} />

      {/* ── Scrollable content ── */}
      <div style={{ position: 'relative', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '56px 48px 80px', width: '100%' }}>

          {/* ── Hero header ── */}
          <div style={{ marginBottom: '52px', animation: 'homeIn 0.55s cubic-bezier(.22,1,.36,1) both' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(229,53,53,0.08)', border: '1px solid rgba(229,53,53,0.2)',
              borderRadius: '20px', padding: '4px 12px 4px 8px',
              marginBottom: '20px',
            }}>
              <span style={{ fontSize: '14px' }}>🎭</span>
              <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--accent)' }}>
                SceneForge
              </span>
            </div>

            <h1 style={{
              fontFamily: "'Cinzel', serif",
              fontSize: '30px', fontWeight: 600, letterSpacing: '4px',
              color: 'var(--text)', marginBottom: '10px', lineHeight: 1.2,
            }}>
              YOUR CAMPAIGNS
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-2)', letterSpacing: '0.3px', lineHeight: 1.7 }}>
              {campaigns.length === 0
                ? 'No campaigns yet — create one to begin your adventure.'
                : `${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''} · Select one to continue.`}
            </p>
          </div>

          {/* ── Campaign grid ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
            gap: '18px',
          }}>

            {campaigns.map((c, i) => {
              const isHov    = hoveredId === c.id
              const accent   = cardAccent(i)
              const delay    = `${i * 0.055}s`

              return (
                <div
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  onMouseEnter={() => setHoveredId(c.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    background: isHov
                      ? `linear-gradient(145deg, ${accent}0.08) 0%, var(--bg-card) 60%)`
                      : 'var(--bg-panel)',
                    border: `1px solid ${isHov ? `${accent}0.38)` : 'var(--border)'}`,
                    borderRadius: '14px',
                    padding: '28px 26px 22px',
                    cursor: 'pointer',
                    transition: 'transform 0.22s cubic-bezier(.22,1,.36,1), box-shadow 0.22s ease, background 0.18s ease, border-color 0.18s ease',
                    transform: isHov ? 'translateY(-4px) scale(1.005)' : 'translateY(0) scale(1)',
                    boxShadow: isHov
                      ? `0 16px 48px rgba(0,0,0,0.45), 0 4px 16px ${accent}0.14)`
                      : '0 2px 10px rgba(0,0,0,0.22)',
                    animation: `homeCardIn 0.5s cubic-bezier(.22,1,.36,1) ${delay} both`,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Top accent line */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                    background: `linear-gradient(90deg, transparent 0%, ${accent}${isHov ? '0.8)' : '0.3)'} 50%, transparent 100%)`,
                    transition: 'opacity 0.2s ease',
                  }} />

                  {/* Icon badge */}
                  <div style={{
                    width: '46px', height: '46px', borderRadius: '11px',
                    background: isHov ? `${accent}0.14)` : 'var(--bg-raised)',
                    border: `1px solid ${isHov ? `${accent}0.32)` : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '20px', marginBottom: '18px',
                    transition: 'all 0.22s ease',
                    transform: isHov ? 'scale(1.06)' : 'scale(1)',
                  }}>
                    🎭
                  </div>

                  {/* Campaign name */}
                  <div style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: '13px', fontWeight: 600, letterSpacing: '1.5px',
                    textTransform: 'uppercase', color: 'var(--text)',
                    marginBottom: '6px', lineHeight: 1.4,
                    transition: 'color 0.15s ease',
                  }}>
                    {c.name}
                  </div>

                  {/* Meta */}
                  <div style={{
                    fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.3px',
                    marginBottom: isHov ? '16px' : '0',
                    transition: 'margin 0.2s ease',
                  }}>
                    Created {formatDate(c.created_at)}
                  </div>

                  {/* CTA on hover */}
                  <div style={{
                    overflow: 'hidden',
                    maxHeight: isHov ? '24px' : '0',
                    opacity: isHov ? 1 : 0,
                    transition: 'max-height 0.22s ease, opacity 0.18s ease',
                  }}>
                    <div style={{
                      fontSize: '10px', fontWeight: 700, letterSpacing: '1.8px',
                      textTransform: 'uppercase',
                      color: `${accent}0.9)`,
                      display: 'flex', alignItems: 'center', gap: '5px',
                    }}>
                      Open Campaign
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transition: 'transform 0.15s ease', transform: isHov ? 'translateX(2px)' : 'none' }}>
                        <path d="M2 5h6M5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* ── New Campaign card ── */}
            <div
              onClick={onNew}
              onMouseEnter={() => setHoveredNew(true)}
              onMouseLeave={() => setHoveredNew(false)}
              style={{
                border: `1px dashed ${hoveredNew ? 'rgba(229,53,53,0.5)' : 'var(--border-lt)'}`,
                borderRadius: '14px',
                padding: '28px 26px',
                cursor: 'pointer',
                transition: 'transform 0.22s cubic-bezier(.22,1,.36,1), box-shadow 0.22s ease, background 0.18s ease, border-color 0.18s ease',
                transform: hoveredNew ? 'translateY(-4px) scale(1.005)' : 'translateY(0) scale(1)',
                background: hoveredNew ? 'rgba(229,53,53,0.04)' : 'transparent',
                boxShadow: hoveredNew ? '0 10px 32px rgba(229,53,53,0.09)' : 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                minHeight: '152px', textAlign: 'center',
                animation: `homeCardIn 0.5s cubic-bezier(.22,1,.36,1) ${campaigns.length * 0.055}s both`,
              }}
            >
              <div style={{
                width: '46px', height: '46px', borderRadius: '50%',
                border: `1.5px dashed ${hoveredNew ? 'rgba(229,53,53,0.55)' : 'var(--border-lt)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: hoveredNew ? 'var(--accent)' : 'var(--text-3)',
                fontSize: '22px', fontWeight: 300,
                marginBottom: '12px',
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

          {/* ── Empty state ── */}
          {campaigns.length === 0 && (
            <div style={{
              marginTop: '60px', textAlign: 'center',
              animation: 'homeIn 0.6s cubic-bezier(.22,1,.36,1) 0.15s both',
            }}>
              <div style={{ fontSize: '48px', opacity: 0.15, marginBottom: '16px' }}>🎭</div>
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
