type Props = {
  onClose: () => void
}

export function FileTreePlaceholder({ onClose }: Props) {
  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface2)', borderRight: '1px solid var(--border)' }}>
      <div
        className="px-3 flex items-center justify-between shrink-0"
        style={{ height: '34px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}
      >
        <span
          className="font-medium"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.1em', fontSize: 12 }}
        >
          EXPLORER
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
            padding: '0 4px',
          }}
          title="閉じる (⌘B)"
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
        >
          ×
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center" style={{ maxWidth: 200 }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
            ファイルツリーは
          </p>
          <p className="text-xs" style={{ color: 'var(--amber-mute)', lineHeight: 1.6, fontWeight: 500 }}>
            Week 2
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
            で実装予定
          </p>
        </div>
      </div>
    </div>
  )
}
