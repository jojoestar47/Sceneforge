'use client'

import { useEffect, useState } from 'react'
import { isIosWebkit } from '@/lib/platform'

export default function SpotifyConnect() {
  const [connected,    setConnected]    = useState<boolean | null>(null) // null = loading
  const [disconnecting, setDisconnecting] = useState(false)
  const [unsupported]  = useState(() => isIosWebkit())

  useEffect(() => {
    fetch('/api/spotify/token')
      .then(r => setConnected(r.ok))
      .catch(() => setConnected(false))
  }, [])

  async function disconnect() {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/spotify/token', { method: 'DELETE' })
      if (res.ok) {
        setConnected(false)
      }
      // If the DELETE failed (network error, server error), we leave the button
      // in the connected state so the user can try again rather than showing
      // them a false "disconnected" while the token is still in the database.
    } catch {
      // Network error — stay connected so user can retry
    } finally {
      setDisconnecting(false)
    }
  }

  if (connected === null) return null

  if (unsupported) {
    return (
      <span
        title="Spotify Web Playback isn’t supported on iPhone or iPad. Use a desktop browser to stream tracks."
        className="btn-sm"
        style={{
          display:     'flex',
          alignItems:  'center',
          gap:         '6px',
          background:  'rgba(255,255,255,0.04)',
          border:      '1px solid var(--border)',
          borderRadius: '6px',
          padding:     '4px 10px',
          color:       'var(--text-3)',
          fontSize:    '11px',
          fontWeight:  600,
          whiteSpace:  'nowrap',
          cursor:      'help',
        }}
      >
        <SpotifyIcon size={13} color="currentColor" />
        <span className="topbar-label">Not on iOS</span>
      </span>
    )
  }

  if (connected) {
    return (
      <button
        onClick={disconnect}
        disabled={disconnecting}
        title="Disconnect Spotify"
        className="btn-sm"
        style={{
          display:     'flex',
          alignItems:  'center',
          gap:         '6px',
          background:  'rgba(30,215,96,0.1)',
          border:      '1px solid rgba(30,215,96,0.35)',
          borderRadius: '6px',
          padding:     '4px 10px',
          cursor:      disconnecting ? 'default' : 'pointer',
          color:       '#1ed760',
          fontSize:    '11px',
          fontWeight:  700,
          whiteSpace:  'nowrap',
          opacity:     disconnecting ? 0.6 : 1,
        }}
      >
        <SpotifyIcon size={13} />
        <span className="topbar-label">{disconnecting ? 'Disconnecting…' : 'Connected'}</span>
      </button>
    )
  }

  return (
    <a
      href="/auth/spotify"
      title="Connect Spotify to use streaming tracks"
      className="btn-sm"
      style={{
        display:     'flex',
        alignItems:  'center',
        gap:         '6px',
        background:  'none',
        border:      '1px solid var(--border-lt)',
        borderRadius: '6px',
        padding:     '4px 10px',
        cursor:      'pointer',
        color:       'var(--text-2)',
        fontSize:    '11px',
        fontWeight:  600,
        whiteSpace:  'nowrap',
        textDecoration: 'none',
      }}
    >
      <SpotifyIcon size={13} color="currentColor" />
      <span className="topbar-label">Spotify</span>
    </a>
  )
}

function SpotifyIcon({ size = 16, color = '#1ed760' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  )
}
