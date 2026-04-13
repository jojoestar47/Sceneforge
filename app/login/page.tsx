'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })

    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        width: '100%', maxWidth: '380px',
        background: 'var(--bg-panel)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '36px 32px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            fontFamily: "'Cinzel Decorative', serif", fontSize: '22px',
            color: 'var(--accent)', letterSpacing: '2px', marginBottom: '8px',
          }}>
            SceneForge
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
            TTRPG Scene Director
          </div>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '14px' }}>📬</div>
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>Check your email</div>
            <div style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.6 }}>
              We sent a magic link to <strong style={{ color: 'var(--text)' }}>{email}</strong>.
              Click it to sign in — no password needed.
            </div>
          </div>
        ) : (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '14px' }}>
              <label className="flabel">Email Address</label>
              <input
                type="email"
                className="finput"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            {error && (
              <div style={{
                background: 'var(--accent-bg)', border: '1px solid var(--accent)',
                borderRadius: '6px', padding: '8px 12px',
                fontSize: '12px', color: 'var(--accent)', marginBottom: '14px',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-red btn-block"
              disabled={loading}
              style={{ padding: '10px', fontSize: '12px', marginTop: '4px' }}
            >
              {loading ? 'Sending…' : 'Send Magic Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
