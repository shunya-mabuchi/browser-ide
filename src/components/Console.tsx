import { useState } from 'react'

export function Console() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface2)', borderTop: '1px solid var(--border)' }}>
      <div
        className="px-4 flex items-center justify-between shrink-0"
        style={{ height: '28px', borderBottom: collapsed ? 'none' : '1px solid var(--border)' }}
      >
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="press"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '2px 4px',
          }}
        >
          <span style={{
            display: 'inline-block',
            transform: collapsed ? 'rotate(-90deg)' : 'none',
            transition: 'transform 150ms',
            color: 'var(--amber)',
          }}>▼</span>
          <span style={{ letterSpacing: '0.1em', fontWeight: 500 }}>CONSOLE</span>
        </button>
      </div>
      {!collapsed && (
        <div className="flex-1 overflow-auto p-3 tabular text-xs">
          <p style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--amber-mute)' }}>$</span>{' '}
            プレビュー実行時のログがここに表示されます
          </p>
          <p style={{ color: 'var(--text-dim)', marginTop: 4 }}>
            （Week 3 で連携実装予定）
          </p>
        </div>
      )}
    </div>
  )
}
