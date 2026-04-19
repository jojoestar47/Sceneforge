'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      gap: '16px',
      background: 'var(--bg)',
      color: 'var(--text)',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <span style={{ fontSize: '32px', opacity: 0.4 }}>⚠</span>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '22px', fontWeight: 600, color: 'var(--accent)' }}>
        Something went wrong
      </h2>
      <p style={{ color: 'var(--text-2)', fontSize: '13px' }}>
        An unexpected error occurred. Your data is safe.
      </p>
      <button className="btn btn-outline" onClick={reset}>
        Try again
      </button>
    </div>
  )
}
