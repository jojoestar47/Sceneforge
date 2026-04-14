'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Mode = 'signin' | 'signup'

export default function LoginPage() {
  const supabase    = createClient()
  const router      = useRouter()
  const [mode, setMode]         = useState<Mode>('signin')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        // Sign in immediately after signup
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) {
          setSuccess('Account created! You can now sign in.')
          setMode('signin')
        } else {
          router.push('/')
          router.refresh()
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        router.push('/')
        router.refresh()
      }
    }

    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '380px',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '36px 32px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            fontFamily: "'Cinzel Decorative', serif",
            fontSize: '22px',
            color: 'var(--accent)',
            letterSpacing: '2px',
            marginBottom: '8px',
          }}>
            SceneForge
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
            TTRPG Scene Director
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-raised)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '3px',
          marginBottom: '24px',
        }}>
          {(['signin', 'signup'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setSuccess('') }}
              style={{
                flex: 1,
                padding: '7px',
                borderRadius: '6px',
                border: 'none',
                fontFamily: 'Inter, sans-serif',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all .15s',
                background: mode === m ? 'var(--accent)' : 'transparent',
                color: mode === m ? '#fff' : 'var(--text-2)',
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
              type="email"
              className="finput"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label className="flabel">Password</label>
            <input
              type="password"
              className="finput"
              placeholder={mode === 'signup' ? 'Choose a password (6+ chars)' : 'Your password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && (
            <div style={{
              background: 'var(--accent-bg)',
              border: '1px solid var(--accent)',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '12px',
              color: 'var(--accent)',
              marginBottom: '14px',
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              background: 'rgba(74,158,101,0.12)',
              border: '1px solid rgba(74,158,101,0.4)',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '12px',
              color: '#6ec48a',
              marginBottom: '14px',
            }}>
              {success}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-red btn-block"
            disabled={loading}
            style={{ padding: '10px', fontSize: '12px' }}
          >
            {loading
              ? (mode === 'signup' ? 'Creating account…' : 'Signing in…')
              : (mode === 'signup' ? 'Create Account' : 'Sign In')}
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
