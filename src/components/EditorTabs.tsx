import { X, FileCode2, Globe, Play } from 'lucide-react'

export type TabKind = 'main' | 'preview'

type Props = {
  active: TabKind
  previewOpen: boolean
  onSelect: (tab: TabKind) => void
  onClosePreview: () => void
  onRun: () => void
}

export function EditorTabs({ active, previewOpen, onSelect, onClosePreview, onRun }: Props) {
  return (
    <div
      className="flex items-stretch shrink-0"
      style={{
        height: 34,
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface2)',
      }}
    >
      <Tab
        active={active === 'main'}
        onClick={() => onSelect('main')}
        icon={<FileCode2 size={12} />}
        label="main.tsx"
      />
      {previewOpen && (
        <Tab
          active={active === 'preview'}
          onClick={() => onSelect('preview')}
          icon={<Globe size={12} />}
          label="Preview"
          onClose={onClosePreview}
        />
      )}
      <div className="flex-1" />
      <button
        onClick={onRun}
        className="press flex items-center gap-1.5 px-3 my-1 mr-2 text-xs font-medium"
        style={{
          color: 'var(--bg)',
          background: 'var(--green)',
          boxShadow: '0 0 8px var(--green-dim)',
          borderRadius: 2,
        }}
        title="⌘Enter で即時実行"
      >
        <Play size={10} />
        実行
      </button>
    </div>
  )
}

function Tab({
  active,
  onClick,
  icon,
  label,
  onClose,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  onClose?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-2 px-3 cursor-pointer group"
      style={{
        background: active ? 'var(--surface)' : 'transparent',
        borderRight: '1px solid var(--border)',
        borderTop: active ? '1px solid var(--amber-strong)' : '1px solid transparent',
        color: active ? 'var(--text)' : 'var(--text-muted)',
        fontSize: 13,
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface3)'
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      <span style={{ color: active ? 'var(--amber)' : 'var(--text-muted)' }}>{icon}</span>
      <span>{label}</span>
      {onClose && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="press"
          style={{
            background: 'transparent',
            border: 'none',
            color: active ? 'var(--text-muted)' : 'var(--text-dim)',
            cursor: 'pointer',
            padding: 2,
            marginLeft: 4,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 2,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--border2)'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--text)'
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = active ? 'var(--text-muted)' : 'var(--text-dim)'
          }}
          aria-label="閉じる"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}
