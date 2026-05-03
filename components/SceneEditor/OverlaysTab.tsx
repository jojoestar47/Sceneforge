'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import UploadZone from '@/components/UploadZone'
import { Section } from './parts'
import type { Draft, OverlayDraft } from './types'

interface Props {
  draft:    Draft
  setDraft: Dispatch<SetStateAction<Draft>>
}

// The orchestrator passes a `key` tied to scene.id, so this component fully
// unmounts on scene change — local form state resets for free, no useEffect.
export default function OverlaysTab({ draft, setDraft }: Props) {
  const [pickerOpen,  setPickerOpen]  = useState(false)
  const [name,        setName]        = useState('')
  const [file,        setFile]        = useState<File | null>(null)
  const [url,         setUrl]         = useState('')
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  function reset() {
    setPickerOpen(false); setName(''); setFile(null); setUrl('')
  }

  function add() {
    if (!name.trim() || (!file && !url)) return
    setDraft(d => ({
      ...d,
      overlays: [...d.overlays, {
        name:            name.trim(),
        source:          'upload',
        url:             url || undefined,
        _file:           file || undefined,
        file_name:       file?.name,
        blend_mode:      'screen',
        opacity:         0.7,
        playback_rate:   1.0,
        scale:           1,
        pan_x:           50,
        pan_y:           50,
        enabled_default: true,
      }],
    }))
    reset()
  }

  /** Patch a single overlay row in the draft. */
  function patch(idx: number, p: Partial<OverlayDraft>) {
    setDraft(d => ({ ...d, overlays: d.overlays.map((x, i) => i === idx ? { ...x, ...p } : x) }))
  }

  function removeAt(idx: number) {
    setDraft(d => ({ ...d, overlays: d.overlays.filter((_, i) => i !== idx) }))
    if (expandedIdx === idx) setExpandedIdx(null)
  }

  return (
    <div style={{ paddingTop: '20px' }}>
      <Section title="Overlays">
        {/* Overlay list */}
        <div>
          {draft.overlays.map((o, idx) => {
            const isExpanded = expandedIdx === idx
            return (
              <div key={idx} style={{ background: 'var(--editor-row)', borderRadius: '8px', marginTop: '8px', overflow: 'hidden' }}>
                {/* Row header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'var(--editor-card)', border: '1px solid var(--border-lt)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', overflow: 'hidden' }}>
                    {o.source === 'library' ? '🌫' : '📁'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '1px' }}>{o.blend_mode} · {Math.round(o.opacity * 100)}% opacity</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setExpandedIdx(isExpanded ? null : idx)}>
                      {isExpanded ? 'Done' : 'Edit'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => removeAt(idx)}>Remove</button>
                  </div>
                </div>

                {/* Expanded controls */}
                {isExpanded && (
                  <div style={{ padding: '0 12px 14px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                    {/* Name */}
                    <div style={{ marginBottom: '10px' }}>
                      <label className="flabel">Name</label>
                      <input className="finput" value={o.name}
                        onChange={e => patch(idx, { name: e.target.value })}
                        style={{ fontSize: '12px', padding: '7px 10px' }} />
                    </div>
                    {/* Blend mode */}
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <label className="flabel">Blend Mode</label>
                        <select className="fselect" value={o.blend_mode}
                          onChange={e => patch(idx, { blend_mode: e.target.value as OverlayDraft['blend_mode'] })}
                          style={{ fontSize: '12px', padding: '7px 8px', width: '100%' }}>
                          <option value="screen">Screen (fog, fire, light)</option>
                          <option value="lighten">Lighten (snow, embers)</option>
                          <option value="multiply">Multiply (storm, shadow)</option>
                          <option value="overlay">Overlay (mood, tint)</option>
                        </select>
                      </div>
                    </div>
                    {/* Opacity + Playback rate */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <div>
                        <label className="flabel">Opacity — {Math.round(o.opacity * 100)}%</label>
                        <input type="range" min={0} max={1} step={0.01} value={o.opacity}
                          onChange={e => patch(idx, { opacity: Number(e.target.value) })}
                          style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', height: '36px' }} />
                      </div>
                      <div>
                        <label className="flabel">Speed — {o.playback_rate.toFixed(1)}x</label>
                        <input type="range" min={0.25} max={2} step={0.05} value={o.playback_rate}
                          onChange={e => patch(idx, { playback_rate: Number(e.target.value) })}
                          style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', height: '36px' }} />
                      </div>
                    </div>
                    {/* Scale + Pan */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <div>
                        <label className="flabel">Scale — {o.scale.toFixed(1)}x</label>
                        <input type="range" min={1} max={3} step={0.1} value={o.scale}
                          onChange={e => patch(idx, { scale: Number(e.target.value) })}
                          style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', height: '36px' }} />
                      </div>
                      <div>
                        <label className="flabel">Pan X — {Math.round(o.pan_x)}%</label>
                        <input type="range" min={0} max={100} step={1} value={o.pan_x}
                          onChange={e => patch(idx, { pan_x: Number(e.target.value) })}
                          style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', height: '36px' }} />
                      </div>
                      <div>
                        <label className="flabel">Pan Y — {Math.round(o.pan_y)}%</label>
                        <input type="range" min={0} max={100} step={1} value={o.pan_y}
                          onChange={e => patch(idx, { pan_y: Number(e.target.value) })}
                          style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', height: '36px' }} />
                      </div>
                    </div>
                    {/* On by default */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-2)' }}>On by default</span>
                      <button
                        onClick={() => patch(idx, { enabled_default: !o.enabled_default })}
                        style={{
                          fontSize: '10px', padding: '5px 12px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                          border: `1px solid ${o.enabled_default ? 'var(--accent)' : 'var(--border)'}`,
                          background: o.enabled_default ? 'var(--accent-bg)' : 'none',
                          color: o.enabled_default ? 'var(--accent)' : 'var(--text-2)',
                        }}
                      >{o.enabled_default ? 'Yes' : 'No'}</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {draft.overlays.length === 0 && (
            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '12px', color: 'var(--text-3)' }}>
              No overlays yet — add fog, rain, smoke, or other atmospheric effects below.
            </div>
          )}
        </div>

        {/* Add overlay */}
        <div style={{ paddingTop: '12px' }}>
          <button className={`add-pill${pickerOpen ? ' active' : ''}`} style={{ fontSize: '10px', padding: '6px 12px' }}
            onClick={() => { pickerOpen ? reset() : setPickerOpen(true) }}>
            + ADD OVERLAY <span style={{ fontSize: '9px' }}>▼</span>
          </button>

          {pickerOpen && (
            <div style={{ background: 'var(--editor-card)', border: '1px solid var(--border-lt)', borderRadius: '8px', padding: '14px', marginTop: '8px' }}>
              <input className="finput" placeholder="Name" value={name}
                onChange={e => setName(e.target.value)}
                style={{ fontSize: '12px', padding: '7px 10px', marginBottom: '10px' }} />
              <UploadZone accept="video/*" label="Drop overlay video here" icon="🎬"
                hint="MP4 or WebM on black background — bright areas show through"
                onFile={f => { setFile(f); setName(n => n || f.name.replace(/\.[^.]+$/, '')) }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0', color: 'var(--text-3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.8px' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />or paste a URL<div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>
              <input className="finput" placeholder="https://… video URL" value={url}
                onChange={e => setUrl(e.target.value)}
                style={{ fontSize: '12px', padding: '7px 10px' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button className="btn btn-ghost btn-sm" onClick={reset}>Cancel</button>
                <button className="btn btn-red btn-sm"
                  disabled={!name.trim() || (!file && !url)}
                  onClick={add}>
                  Add Overlay
                </button>
              </div>
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}
