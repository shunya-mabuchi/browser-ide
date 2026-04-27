import { Files, MessageSquare, Terminal } from 'lucide-react'

type Props = {
  showExplorer: boolean
  showChat: boolean
  showConsole: boolean
  onToggleExplorer: () => void
  onToggleChat: () => void
  onToggleConsole: () => void
}

export function ActivityBar(props: Props) {
  return (
    <div
      style={{
        width: 44,
        borderRight: '1px solid var(--border)',
        background: 'var(--surface2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: '8px 0',
        flexShrink: 0,
      }}
    >
      <ActivityIcon label="Explorer (⌘B)" active={props.showExplorer} onClick={props.onToggleExplorer}>
        <Files size={20} />
      </ActivityIcon>
      <ActivityIcon label="Chat (⌘\\)" active={props.showChat} onClick={props.onToggleChat}>
        <MessageSquare size={20} />
      </ActivityIcon>
      <div style={{ flex: 1 }} />
      <ActivityIcon label="Console (⌘J)" active={props.showConsole} onClick={props.onToggleConsole}>
        <Terminal size={18} />
      </ActivityIcon>
    </div>
  )
}

function ActivityIcon({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="press"
      style={{
        width: 36,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: active ? 'var(--amber-strong)' : 'var(--text-muted)',
        borderLeft: active ? '2px solid var(--amber-strong)' : '2px solid transparent',
        transition: 'color 150ms var(--ease)',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text)'
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
      }}
    >
      {children}
    </button>
  )
}
