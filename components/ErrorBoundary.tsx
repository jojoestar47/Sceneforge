'use client'

import React from 'react'

interface Props {
  children:  React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[SceneForge] Unhandled render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: '#080a10' }}>
          <div style={{ fontFamily: "'Cinzel Decorative',serif", fontSize: '22px', color: '#e53535', letterSpacing: '2px' }}>
            SceneForge
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', textAlign: 'center', maxWidth: '400px', lineHeight: 1.6 }}>
            Something went wrong. Please refresh the page to continue.
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'rgba(255,255,255,0.2)', maxWidth: '400px', textAlign: 'center', padding: '8px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px' }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '8px 20px', background: 'rgba(229,53,53,0.12)', border: '1px solid rgba(229,53,53,0.35)', borderRadius: '6px', color: '#e53535', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
          >
            Refresh Page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
