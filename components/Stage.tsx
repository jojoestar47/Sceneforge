'use client'

import type { Scene } from '@/lib/types'

interface Props {
  scene: Scene | null
  hasCampaign: boolean
  onEdit: () => void
}

function mediaUrl(m: Scene['bg']): string | null {
  if (!m) return null
  return m.signed_url || m.url || null
}

export default function Stage({ scene, hasCampaign, onEdit }: Props) {
  if (!scene) {
    return (
      <div style={{
        flex: 1, background: '#080a10', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center', color: 'var(--text-3)' }}>
          <div style={{ fontSize: '44px', opacity: .2, marginBottom: '12px' }}>🎭</div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2.5px' }}>
            {hasCampaign ? 'Select a Scene' : 'Select a Campaign'}
          </div>
        </div>
      </div>
    )
  }

  const bgUrl  = mediaUrl(scene.bg)
  const ovUrl  = mediaUrl(scene.overlay)
  const isVid  = (type?: string) => type === 'video'

  return (
    <div style={{ flex: 1, position: 'relative', background: '#080a10', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Background */}
      {bgUrl && (
        isVid(scene.bg?.type)
          ? <video key={bgUrl} src={bgUrl} autoPlay loop muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          : <img key={bgUrl} src={bgUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}

      {/* Vignette */}
      {bgUrl && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center,transparent 35%,rgba(0,0,0,.55) 100%)',
          pointerEvents: 'none', zIndex: 2,
        }} />
      )}

      {/* Overlay */}
      {ovUrl && (
        isVid(scene.overlay?.type)
          ? <video key={ovUrl} src={ovUrl} autoPlay loop muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 3, pointerEvents: 'none' }} />
          : <img key={ovUrl} src={ovUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 3, pointerEvents: 'none' }} />
      )}

      {/* Scene name */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        textAlign: 'center', padding: '14px',
        fontFamily: "'Cinzel', serif", fontSize: '14px', letterSpacing: '5px', fontWeight: 500,
        color: 'rgba(255,255,255,.75)', textShadow: '0 1px 12px rgba(0,0,0,.9)',
        pointerEvents: 'none', zIndex: 5,
      }}>
        {scene.name}
      </div>

      {/* No bg placeholder */}
      {!bgUrl && (
        <div style={{ zIndex: 1, textAlign: 'center', color: 'var(--text-3)' }}>
          <div style={{ fontSize: '40px', opacity: .2, marginBottom: '12px' }}>🖼</div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2.5px', marginBottom: '14px' }}>No Background</div>
          <button className="btn btn-outline" onClick={onEdit}>Edit Scene</button>
        </div>
      )}

      {/* Edit button */}
      <button
        className="btn btn-ghost btn-sm"
        onClick={onEdit}
        style={{ position: 'absolute', bottom: '14px', right: '14px', zIndex: 5 }}
      >
        ⚙ Edit Scene
      </button>
    </div>
  )
}
