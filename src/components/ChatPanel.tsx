import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CornerDownLeft, Square } from 'lucide-react'
import type { ModelState } from '../hooks/useLlmModel'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  messages: Message[]
  isGenerating: boolean
  onSend: (text: string) => void
  onAbort: () => void
  onApplyCode: (code: string) => void
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
  modelState: ModelState
  onPickModel: () => void
  onSwitchModel: () => void
  onUnloadModel: () => void
  onCancelLoad: () => void
  onRetryLoad: () => void
}

const SAMPLE_PROMPTS = [
  'カウンターアプリを作って',
  'Todoリストを書いて',
  '電卓を作って',
  'ボタンの色を青に変えて',
]

function extractCodeBlock(text: string): string | null {
  const match = text.match(/```(?:\w+)?\n([\s\S]+?)```/)
  return match ? match[1].trim() : null
}

function MessageBubble({ msg, onApplyCode }: { msg: Message; onApplyCode: (c: string) => void }) {
  const code = msg.role === 'assistant' ? extractCodeBlock(msg.content) : null
  const isUser = msg.role === 'user'

  return (
    <div className="animate-fade-in flex flex-col gap-2">
      <div className="flex items-start gap-2.5">
        <span
          className="shrink-0 text-sm pt-0.5 select-none font-medium"
          style={{ color: isUser ? 'var(--amber)' : 'var(--text-dim)', minWidth: '18px' }}
        >
          {isUser ? '>' : '$'}
        </span>
        <div
          className="text-sm leading-relaxed whitespace-pre-wrap break-words flex-1 min-w-0"
          style={{ color: isUser ? 'var(--text)' : 'var(--text-muted)' }}
        >
          {msg.content || <span className="cursor-blink" style={{ color: 'var(--text-dim)' }}>_</span>}
        </div>
      </div>
      {code && (
        <button
          onClick={() => onApplyCode(code)}
          className="press ml-7 self-start text-sm px-3 py-1"
          style={{ color: 'var(--amber)', border: '1px solid var(--amber)', opacity: 0.75, background: 'transparent' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.background = 'var(--amber-dim)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.75'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          エディタに適用
        </button>
      )}
    </div>
  )
}

const menuItemStyle: React.CSSProperties = {
  width: '100%',
  textAlign: 'left',
  padding: '8px 12px',
  background: 'transparent',
  border: 'none',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: 13,
}

function HeaderBar({
  modelState,
  isGenerating,
  onSwitchModel,
  onUnloadModel,
}: {
  modelState: ModelState
  isGenerating: boolean
  onSwitchModel: () => void
  onUnloadModel: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)

  useEffect(() => {
    if (!menuOpen) {
      setMenuPos(null)
      return
    }
    const btn = buttonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    setMenuPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    })

    const onDocClick = (e: MouseEvent) => {
      if (!btn.contains(e.target as Node)) setMenuOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [menuOpen])

  return (
    <div
      className="px-4 py-2.5 flex items-center gap-2 shrink-0"
      style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}
    >
      <span
        className="w-2 h-2 rounded-full animate-pulse-amber"
        style={{ background: 'var(--amber)', boxShadow: '0 0 6px var(--amber-strong)' }}
      />
      <span className="text-sm" style={{ color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
        AIチャット
      </span>
      {isGenerating && modelState.kind === 'ready' && (
        <span className="text-sm tabular" style={{ color: 'var(--amber-mute)' }}>
          生成中<span className="cursor-blink">_</span>
        </span>
      )}
      {modelState.kind === 'ready' && (
        <button
          ref={buttonRef}
          onClick={() => setMenuOpen((v) => !v)}
          className="press text-sm ml-auto"
          style={{
            background: menuOpen ? 'var(--amber-glow)' : 'transparent',
            border: '1px solid var(--border2)',
            color: menuOpen ? 'var(--amber)' : 'var(--text-muted)',
            cursor: 'pointer',
            padding: '2px 10px',
            fontWeight: 600,
            letterSpacing: '0.1em',
          }}
          aria-label="モデル操作メニュー"
        >
          ⋯
        </button>
      )}
      {menuOpen && menuPos && createPortal(
        <div
          style={{
            position: 'fixed',
            top: menuPos.top,
            right: menuPos.right,
            background: 'var(--surface2)',
            border: '1px solid var(--border2)',
            borderRadius: 4,
            minWidth: 200,
            zIndex: 1000,
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            overflow: 'hidden',
          }}
        >
          <button
            onClick={() => { setMenuOpen(false); onSwitchModel() }}
            style={menuItemStyle}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--amber-glow)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            モデル切替
          </button>
          <button
            onClick={() => { setMenuOpen(false); onUnloadModel() }}
            style={menuItemStyle}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--amber-glow)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            モデルをアンロード
          </button>
        </div>,
        document.body,
      )}
    </div>
  )
}

function IdleView({ onPickModel }: { onPickModel: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center flex-col gap-4 p-6">
      <p className="text-sm text-center" style={{ color: 'var(--text-dim)' }}>
        AI を使うにはモデルを選択してください
      </p>
      <button
        onClick={onPickModel}
        className="press"
        style={{
          padding: '8px 20px',
          background: 'var(--amber-strong)',
          color: 'var(--bg)',
          border: 'none',
          borderRadius: 2,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '0.05em',
          boxShadow: '0 0 16px var(--amber-glow)',
        }}
      >
        モデルを選択
      </button>
    </div>
  )
}

function LoadingView({
  state,
  onCancel,
}: {
  state: Extract<ModelState, { kind: 'loading' }>
  onCancel: () => void
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
      <p className="text-sm" style={{ color: 'var(--text)' }}>
        {state.modelName}
      </p>
      <p className="text-xs tabular" style={{ color: 'var(--text-dim)' }}>
        {state.progressText} ({Math.round(state.progress * 100)}%)
      </p>
      <div
        style={{
          width: '80%',
          height: 2,
          background: 'var(--border2)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${state.progress * 100}%`,
            height: '100%',
            background: 'var(--amber-strong)',
            boxShadow: '0 0 8px var(--amber)',
            transition: 'width 200ms ease',
          }}
        />
      </div>
      <p className="text-xs text-center" style={{ color: 'var(--text-dim)' }}>
        ※ ダウンロード中もエディタは使えます
      </p>
      <button
        onClick={onCancel}
        className="press"
        style={{
          padding: '6px 16px',
          background: 'transparent',
          color: 'var(--text-dim)',
          border: '1px solid var(--border2)',
          cursor: 'pointer',
          fontSize: 12,
        }}
      >
        キャンセル
      </button>
    </div>
  )
}

function ErrorView({
  state,
  onRetry,
  onPickModel,
}: {
  state: Extract<ModelState, { kind: 'error' }>
  onRetry: () => void
  onPickModel: () => void
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
      <p className="text-sm" style={{ color: 'var(--red)' }}>
        モデル読込失敗
      </p>
      <p className="text-xs text-center" style={{ color: 'var(--text-dim)', maxWidth: 280 }}>
        {state.message}
      </p>
      <div className="flex gap-2">
        <button
          onClick={onRetry}
          className="press"
          style={{
            padding: '6px 16px',
            background: 'var(--amber-strong)',
            color: 'var(--bg)',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          再試行
        </button>
        <button
          onClick={onPickModel}
          className="press"
          style={{
            padding: '6px 16px',
            background: 'transparent',
            color: 'var(--text)',
            border: '1px solid var(--border2)',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          別モデルを選ぶ
        </button>
      </div>
    </div>
  )
}

function ReadyView({
  messages,
  isGenerating,
  onSend,
  onAbort,
  onApplyCode,
  inputRef,
}: {
  messages: Message[]
  isGenerating: boolean
  onSend: (text: string) => void
  onAbort: () => void
  onApplyCode: (code: string) => void
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
}) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const localInputRef = useRef<HTMLTextAreaElement>(null)
  const textareaRef = inputRef ?? localInputRef

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight
      stickToBottomRef.current = distance < 80
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (!stickToBottomRef.current) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  const handleSubmit = (text?: string) => {
    const value = (text ?? input).trim()
    if (!value || isGenerating) return
    onSend(value)
    setInput('')
    stickToBottomRef.current = true
  }

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
        {messages.length === 0 && (
          <div className="flex flex-col gap-3 mt-1">
            <span className="text-sm" style={{ color: 'var(--text-dim)' }}>
              &gt; どんなアプリを作りますか？
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {SAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => handleSubmit(p)}
                  className="press text-xs px-2.5 py-1"
                  style={{
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border2)',
                    background: 'transparent',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            <span className="text-xs mt-2" style={{ color: 'var(--text-dim)' }}>
              ⌘K で入力にフォーカス
            </span>
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} onApplyCode={onApplyCode} />
        ))}
      </div>

      <div className="shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-start gap-0">
          <span className="px-4 py-3 text-sm select-none shrink-0" style={{ color: 'var(--amber)' }}>
            &gt;
          </span>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            placeholder="メッセージを入力..."
            rows={2}
            className="flex-1 py-3 pr-2 text-sm resize-none outline-none"
            style={{
              background: 'transparent',
              color: 'var(--text)',
              caretColor: 'var(--amber)',
              fontFamily: 'var(--font)',
            }}
          />
          <button
            onClick={() => (isGenerating ? onAbort() : handleSubmit())}
            disabled={!isGenerating && !input.trim()}
            className="press p-3 shrink-0 disabled:opacity-20"
            style={{ color: isGenerating ? 'var(--red)' : 'var(--amber)', background: 'transparent' }}
          >
            {isGenerating ? <Square size={14} /> : <CornerDownLeft size={14} />}
          </button>
        </div>
      </div>
    </>
  )
}

export function ChatPanel(props: Props) {
  const { modelState } = props
  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface)' }}>
      <HeaderBar
        modelState={modelState}
        isGenerating={props.isGenerating}
        onSwitchModel={props.onSwitchModel}
        onUnloadModel={props.onUnloadModel}
      />
      {modelState.kind === 'idle' && <IdleView onPickModel={props.onPickModel} />}
      {modelState.kind === 'loading' && <LoadingView state={modelState} onCancel={props.onCancelLoad} />}
      {modelState.kind === 'error' && (
        <ErrorView state={modelState} onRetry={props.onRetryLoad} onPickModel={props.onPickModel} />
      )}
      {modelState.kind === 'ready' && (
        <ReadyView
          messages={props.messages}
          isGenerating={props.isGenerating}
          onSend={props.onSend}
          onAbort={props.onAbort}
          onApplyCode={props.onApplyCode}
          inputRef={props.inputRef}
        />
      )}
    </div>
  )
}
