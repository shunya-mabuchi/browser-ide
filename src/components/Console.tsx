type Props = {
  onClose: () => void
}

export function Console({ onClose }: Props) {
  return (
    <div className="flex flex-col h-full w-full min-w-0" style={{ background: 'var(--surface2)', borderTop: '1px solid var(--border)' }}>
      <div
        className="px-4 flex items-center justify-between shrink-0"
        style={{ height: '28px', borderBottom: '1px solid var(--border)' }}
      >
        <span
          className="flex items-center gap-2"
          style={{ color: 'var(--text-muted)', fontSize: 12, letterSpacing: '0.1em', fontWeight: 500 }}
        >
          <span style={{ color: 'var(--amber)' }}>›</span>
          CONSOLE
        </span>
        <button
          onClick={onClose}
          className="press"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: '0 6px',
          }}
          title="閉じる (⌘J)"
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
        >
          ×
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3 tabular text-xs">
        <p style={{ color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--amber-mute)' }}>$</span>{' '}
          プレビュー実行時のログがここに表示されます
        </p>
        <p style={{ color: 'var(--text-dim)', marginTop: 4 }}>
          （Week 3 で連携実装予定）
        </p>
      </div>
    </div>
  )
}
