export function FileTreePlaceholder() {
  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface2)', borderRight: '1px solid var(--border)' }}>
      <div
        className="px-4 flex items-center"
        style={{ height: '34px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          📁 EXPLORER
        </span>
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
