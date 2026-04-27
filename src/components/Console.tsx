import { useState } from 'react'

export function Console() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface2)', borderTop: '1px solid var(--border)' }}>
      <div
        className="px-4 flex items-center justify-between shrink-0"
        style={{ height: '28px', borderBottom: '1px solid var(--border)' }}
      >
        <button
          onClick={() => setCollapsed((v) => !v)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ display: 'inline-block', transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 150ms' }}>▼</span>
          <span style={{ letterSpacing: '0.06em' }}>CONSOLE</span>
        </button>
      </div>
      {!collapsed && (
        <div className="flex-1 overflow-auto p-3 tabular text-xs" style={{ color: 'var(--text-dim)' }}>
          <p style={{ opacity: 0.5 }}>
            （プレビュー実行時のログがここに表示されます。Week 3 で連携実装予定。）
          </p>
        </div>
      )}
    </div>
  )
}
