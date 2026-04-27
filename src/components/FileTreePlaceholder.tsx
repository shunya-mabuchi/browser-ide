import { FileCode2, FolderClosed, Lock } from 'lucide-react'

type Props = {
  onClose: () => void
}

export function FileTreePlaceholder({ onClose }: Props) {
  return (
    <div className="flex flex-col h-full w-full min-w-0" style={{ background: 'var(--surface2)', borderRight: '1px solid var(--border)' }}>
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

      {/* Sample mock tree to give a sense of what's coming */}
      <div className="flex-1 overflow-auto" style={{ padding: '8px 0' }}>
        <MockNode depth={0} icon={<FolderClosed size={12} />} label="workspace" expanded muted />
        <MockNode depth={1} icon={<FileCode2 size={12} />} label="main.tsx" current />
        <MockNode depth={1} icon={<FolderClosed size={12} />} label="components" muted />
        <MockNode depth={2} icon={<FileCode2 size={12} />} label="(Week 2 で実装)" stub />
        <div style={{ marginTop: 16, padding: '0 12px' }}>
          <div
            style={{
              padding: '10px 12px',
              border: '1px dashed var(--border2)',
              borderRadius: 4,
              background: 'var(--surface3)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <Lock size={12} style={{ color: 'var(--amber-mute)', marginTop: 2, flexShrink: 0 }} />
            <div>
              <p style={{ color: 'var(--text)', fontSize: 11, fontWeight: 500, marginBottom: 4 }}>
                Week 2 で開放予定
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: 10, lineHeight: 1.5 }}>
                ファイル CRUD・フォルダ階層・DnD・OPFS 連携が入ります
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MockNode({
  depth,
  icon,
  label,
  expanded,
  current,
  muted,
  stub,
}: {
  depth: number
  icon: React.ReactNode
  label: string
  expanded?: boolean
  current?: boolean
  muted?: boolean
  stub?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px',
        paddingLeft: 12 + depth * 14,
        fontSize: 12,
        color: stub ? 'var(--text-dim)' : current ? 'var(--text)' : muted ? 'var(--text-muted)' : 'var(--text)',
        background: current ? 'var(--amber-glow)' : 'transparent',
        borderLeft: current ? '2px solid var(--amber-strong)' : '2px solid transparent',
        cursor: 'default',
        userSelect: 'none',
        fontStyle: stub ? 'italic' : 'normal',
      }}
    >
      <span style={{ color: current ? 'var(--amber)' : muted ? 'var(--text-muted)' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center' }}>
        {expanded ? '▾' : ''}
        {!expanded && depth === 0 && '▸'}
        {!expanded && depth > 0 && <span style={{ width: 8 }} />}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', color: stub ? 'var(--text-dim)' : 'var(--text-muted)' }}>
        {icon}
      </span>
      <span>{label}</span>
    </div>
  )
}
