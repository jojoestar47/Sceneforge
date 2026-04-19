import Link from 'next/link'

export default function NotFound() {
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
      <span style={{ fontSize: '32px', opacity: 0.4 }}>✦</span>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '22px', fontWeight: 600, color: 'var(--accent)' }}>
        Page not found
      </h2>
      <p style={{ color: 'var(--text-2)', fontSize: '13px' }}>
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link href="/" className="btn btn-outline">
        Back to campaigns
      </Link>
    </div>
  )
}
