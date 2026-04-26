import { useState, useRef, useEffect } from 'react'
import { CornerDownLeft, Square } from 'lucide-react'

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

export function ChatPanel({ messages, isGenerating, onSend, onAbort, onApplyCode, inputRef }: Props) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const localInputRef = useRef<HTMLTextAreaElement>(null)
  const textareaRef = inputRef ?? localInputRef

  // Auto-scroll only when the user is already near the bottom.
  // If they scrolled up to read history, don't yank them back.
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
    // Use instant scroll while streaming so it actually keeps up.
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
    <div className="flex flex-col h-full" style={{ background: 'var(--surface)' }}>
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
        {isGenerating && (
          <span className="text-sm ml-auto tabular" style={{ color: 'var(--amber-mute)' }}>
            生成中<span className="cursor-blink">_</span>
          </span>
        )}
      </div>

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
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLElement
                    el.style.color = 'var(--amber)'
                    el.style.borderColor = 'var(--amber-mute)'
                    el.style.background = 'var(--amber-glow)'
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLElement
                    el.style.color = 'var(--text-muted)'
                    el.style.borderColor = 'var(--border2)'
                    el.style.background = 'transparent'
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
    </div>
  )
}
