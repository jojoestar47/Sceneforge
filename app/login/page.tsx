'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Mode    = 'signin' | 'signup'
type UIState = 'idle' | 'loading' | 'confirm_email' | 'success'

export default function LoginPage() {
  const supabase = createClient()
  const router   = useRouter()

  const [mode, setMode]         = useState<Mode>('signin')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [ui, setUi]             = useState<UIState>('idle')
  const [error, setError]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setUi('loading')
    setError('')

    if (mode === 'signup') {
      const { error: signUpError } = await supabase.auth.signUp({ email, password })

      if (signUpError) {
        setError(signUpError.message)
        setUi('idle')
        return
      }

      // Try to sign in immediately — works if email confirmation is OFF
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        // Email confirmation is ON — ask them to check their inbox once
        setUi('confirm_email')
      } else {
        router.push('/')
        router.refresh()
      }

    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        // Friendly messages for common errors
        if (error.message.includes('Invalid login')) {
          setError('Incorrect email or password.')
        } else if (error.message.includes('Email not confirmed')) {
          setError('Please confirm your email first — check your inbox.')
        } else {
          setError(error.message)
        }
        setUi('idle')
      } else {
        router.push('/')
        router.refresh()
      }
    }
  }

  // ── Confirm email screen ───────────────────────────
  if (ui === 'confirm_email') {
    return (
      <div style={outerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '42px', marginBottom: '14px' }}>📬</div>
            <div style={{ fontFamily: "'Cinzel Decorative',serif", fontSize: '16px', color: 'var(--accent)', marginBottom: '14px' }}>
              Check your email
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '20px' }}>
              We sent a confirmation link to <strong style={{ color: 'var(--text)' }}>{email}</strong>.
              <br />
              Click it once — then come back here and sign in.
              <br />
              <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>You will never need to do this again.</span>
            </div>
            <button
              className="btn btn-ghost btn-block"
              onClick={() => { setMode('signin'); setUi('idle') }}
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main form ──────────────────────────────────────
  return (
    <div style={outerStyle}>
      <div style={cardStyle}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontFamily: "'Cinzel Decorative',serif", fontSize: '22px', color: 'var(--accent)', letterSpacing: '2px', marginBottom: '8px' }}>
            Reverie
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>TTRPG Scene Director</div>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '8px', padding: '3px', marginBottom: '24px' }}>
          {(['signin', 'signup'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError('') }}
              style={{
                flex: 1, padding: '7px', borderRadius: '6px', border: 'none',
                fontFamily: 'Inter,sans-serif', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', transition: 'all .15s',
                background: mode === m ? 'var(--accent)' : 'transparent',
                color:      mode === m ? '#fff'          : 'var(--text-2)',
              }}
            >
              {m === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label className="flabel">Email</label>
            <input
              type="email" className="finput"
              placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)}
              required autoFocus
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label className="flabel">Password</label>
            <input
              type="password" className="finput"
              placeholder={mode === 'signup' ? 'Choose a password (6+ chars)' : 'Your password'}
              value={password} onChange={e => setPassword(e.target.value)}
              required minLength={6}
            />
          </div>

          {error && (
            <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', color: 'var(--accent)', marginBottom: '14px' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-red btn-block"
            disabled={ui === 'loading'}
            style={{ padding: '10px', fontSize: '12px' }}
          >
            {ui === 'loading'
              ? (mode === 'signup' ? 'Creating account…' : 'Signing in…')
              : (mode === 'signup' ? 'Create Account'    : 'Sign In')}
          </button>
        </form>

        {mode === 'signin' && (
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
              No account yet?{' '}
              <button
                onClick={() => { setMode('signup'); setError('') }}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}
              >
                Create one
              </button>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

const outerStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--bg)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '24px',
}

const cardStyle: React.CSSProperties = {
  width: '100%', maxWidth: '380px',
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  padding: '36px 32px',
  boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
}
