'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <html>
      <body style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: '16px',
        background: '#13151d',
        color: '#e0e3f0',
        fontFamily: "'DM Sans', sans-serif",
        margin: 0,
      }}>
        <span style={{ fontSize: '32px', opacity: 0.4 }}>⚠</span>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '22px', fontWeight: 600, color: '#c9a84c' }}>
          Something went wrong
        </h2>
        <p style={{ color: '#6b7090', fontSize: '13px' }}>
          An unexpected error occurred. Your data is safe.
        </p>
        <button
          onClick={reset}
          style={{
            background: 'transparent',
            border: '1px solid #c9a84c',
            color: '#c9a84c',
            borderRadius: '6px',
            padding: '6px 13px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
