'use client'

import { useEffect, useRef, type ReactNode, type CSSProperties } from 'react'

interface ModalProps {
  onClose:           () => void
  /** Click outside the modal panel closes. Default true. */
  closeOnBackdrop?:  boolean
  /** ESC key closes. Default true. */
  closeOnEsc?:       boolean
  /** Stacking order. Default 200; ConfirmModal raises this for nesting. */
  zIndex?:           number
  children:          ReactNode
}

/**
 * Backdrop + ESC + focus-restoration shell.
 *
 * Most modals also want the standard centered card — wrap children in
 * <ModalPanel>. SceneEditor uses just <Modal> because it has an unusual
 * layout (save/discard buttons sitting outside the panel).
 *
 * Stacked modals each register their own ESC listener, so pressing Esc
 * closes the whole stack. That matches the user's intent (back out) for
 * the only nesting case we have today: ConfirmModal opened from inside
 * another modal. If we ever need just-the-top-modal Esc, switch to a
 * shared stack ref.
 */
export default function Modal({
  onClose,
  closeOnBackdrop = true,
  closeOnEsc      = true,
  zIndex          = 200,
  children,
}: ModalProps) {
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null
    return () => {
      // Guard: the previously-focused element may have been unmounted
      // (e.g. modal opened from a row that was deleted by the action).
      const el = restoreFocusRef.current
      if (el && document.body.contains(el)) el.focus()
    }
  }, [])

  useEffect(() => {
    if (!closeOnEsc) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closeOnEsc, onClose])

  return (
    <div
      onClick={closeOnBackdrop ? (e => { if (e.target === e.currentTarget) onClose() }) : undefined}
      style={{
        position: 'fixed', inset: 0, zIndex,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </div>
  )
}

interface ModalPanelProps {
  children: ReactNode
  width?:   number | string
  style?:   CSSProperties
}

/** Standard centered card: --bg-panel surface, 10px radius, scrolls if tall. */
export function ModalPanel({ children, width = 400, style }: ModalPanelProps) {
  return (
    <div
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        width,
        maxWidth: '94vw',
        maxHeight: 'calc(100vh - 32px)',
        overflowY: 'auto',
        boxShadow: '0 24px 70px rgba(0,0,0,.85)',
        display: 'flex', flexDirection: 'column',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
