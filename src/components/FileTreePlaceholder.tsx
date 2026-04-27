export function FileTreePlaceholder() {
  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface2)', borderRight: '1px solid var(--border)' }}>
      <div
        className="px-4 flex items-center"
        style={{ height: '34px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}
      >
        <span className="text-sm" style={{ color: 'var(--text-dim)', letterSpacing: '0.06em' }}>
          📁 EXPLORER
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-xs text-center" style={{ color: 'var(--text-dim)' }}>
          ファイルツリーは Week 2 で実装予定
        </p>
      </div>
    </div>
  )
}
