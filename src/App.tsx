import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Play } from 'lucide-react'
import { Editor } from './components/Editor'
import { Preview, type PreviewStatus } from './components/Preview'
import { ChatPanel, type Message } from './components/ChatPanel'
import { ModelPicker } from './components/ModelPicker'
import { Splitter } from './components/Splitter'
import { Console } from './components/Console'
import { FileTreePlaceholder } from './components/FileTreePlaceholder'
import { ToastProvider, useToast } from './components/Toast'
import { useLlmModel, type ModelState } from './hooks/useLlmModel'
import './index.css'

const DEFAULT_CODE = `function App() {
  const [count, setCount] = React.useState(0)

  return (
    <div style={{ padding: 32, fontFamily: 'system-ui, sans-serif', maxWidth: 400 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: '#111' }}>
        BrowserIDE へようこそ
      </h1>
      <p style={{ color: '#666', marginBottom: 24, lineHeight: 1.6 }}>
        コードを編集すると自動でプレビューが更新されます。
        AIチャットでコードを生成して「エディタに適用」も試してみてください。
      </p>
      <button
        onClick={() => setCount(c => c + 1)}
        style={{
          padding: '8px 20px',
          background: '#111',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        クリック: {count}
      </button>
    </div>
  )
}
`

function formatTime(ts: number) {
  const d = new Date(ts)
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  const ss = d.getSeconds().toString().padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  )
}

function AppInner() {
  const toast = useToast()
  const llm = useLlmModel(useCallback(() => {
    toast.show('warn', 'WebGPU 非対応環境です。CPU 動作になり推論が大幅に遅くなります（〜2 tok/s）')
  }, [toast]))

  const [code, setCode] = useState(DEFAULT_CODE)
  const [previewCode, setPreviewCode] = useState(DEFAULT_CODE)
  const [messages, setMessages] = useState<Message[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>({ kind: 'idle' })
  const [editorFlashKey, setEditorFlashKey] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)

  const chatInputRef = useRef<HTMLTextAreaElement>(null)
  const lastLoadOptsRef = useRef<{ modelId: string; modelName?: string } | null>(null)

  // Migrate old localStorage keys (one-time, v2 = fresh splitter defaults after layout rework)
  useEffect(() => {
    if (localStorage.getItem('bide.migrated.v2')) return
    for (const k of ['bide.split.h', 'bide.split.v', 'bide.split.tree', 'bide.split.chat', 'bide.split.console']) {
      localStorage.removeItem(k)
    }
    localStorage.setItem('bide.migrated.v2', 'true')
  }, [])

  // Auto-preview (1.5s debounce)
  useEffect(() => {
    const timer = setTimeout(() => setPreviewCode(code), 1500)
    return () => clearTimeout(timer)
  }, [code])

  // Global shortcuts: ⌘Enter run, ⌘K focus chat
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'Enter') {
        e.preventDefault()
        setPreviewCode(code)
      } else if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        chatInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [code])

  // Track last load options for retry
  useEffect(() => {
    if (llm.state.kind === 'loading' || llm.state.kind === 'ready') {
      lastLoadOptsRef.current = {
        modelId: llm.state.modelId,
        modelName: 'modelName' in llm.state ? llm.state.modelName : undefined,
      }
    }
  }, [llm.state])

  const sendMessage = useCallback((text: string) => {
    const userMsg: Message = { role: 'user', content: text }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setIsGenerating(true)
    setMessages([...updatedMessages, { role: 'assistant', content: '' }])

    llm.sendChat(
      [
        {
          role: 'system',
          content: 'You are a coding assistant. Always include React as a global (it is available as window.React). Return code in ```tsx code blocks.',
        },
        ...updatedMessages.map((m) => ({ role: m.role, content: m.content })),
      ],
      (delta) => {
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = {
            ...next[next.length - 1],
            content: next[next.length - 1].content + delta,
          }
          return next
        })
      },
      () => setIsGenerating(false),
      (msg) => {
        setIsGenerating(false)
        toast.show('error', `送信エラー: ${msg}`)
      },
    )
  }, [messages, llm, toast])

  const abortGeneration = useCallback(() => {
    llm.abortChat()
    setIsGenerating(false)
  }, [llm])

  const applyCode = useCallback((newCode: string) => {
    setCode(newCode)
    setPreviewCode(newCode)
    setEditorFlashKey((n) => n + 1)
  }, [])

  const handleCursorChange = useCallback((line: number, col: number) => {
    setCursor({ line, col })
  }, [])

  const handlePickModel = useCallback((modelId: string, displayName?: string) => {
    setPickerOpen(false)
    llm.loadModel({ modelId, modelName: displayName })
  }, [llm])

  const retryLoad = useCallback(() => {
    const opts = lastLoadOptsRef.current
    if (opts) llm.loadModel(opts)
  }, [llm])

  const statusInfo = useMemo(() => {
    switch (previewStatus.kind) {
      case 'compiling':
        return { dot: 'var(--amber)', label: 'compile', detail: 'コンパイル中' }
      case 'ok':
        return { dot: 'var(--green)', label: 'ok', detail: formatTime(previewStatus.ranAt) }
      case 'error':
        return { dot: 'var(--red)', label: 'error', detail: previewStatus.message }
      default:
        return { dot: 'var(--text-dim)', label: 'idle', detail: '待機中' }
    }
  }, [previewStatus])

  const lineCount = useMemo(() => code.split('\n').length, [code])
  const charCount = code.length

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)' }}>
      <Header llmState={llm.state} statusLabel={statusInfo.label} statusDot={statusInfo.dot} />

      <div className="flex flex-1 overflow-hidden">
        <Splitter storageKey="bide.split.tree" defaultPercent={15} min={10} max={32} orientation="vertical">
          <FileTreePlaceholder />

          <Splitter storageKey="bide.split.chat" defaultPercent={70} min={50} max={85} orientation="vertical">
            {/* Center area: editor+preview on top, console at bottom */}
            <Splitter storageKey="bide.split.console" defaultPercent={75} min={40} max={100} orientation="horizontal">
              {/* Top: editor | preview side-by-side */}
              <Splitter storageKey="bide.split.preview" defaultPercent={55} min={30} max={80} orientation="vertical">
                {/* Editor */}
                <div className="flex flex-col min-w-0 w-full h-full">
                  <div
                    className="flex items-center justify-between px-4 shrink-0"
                    style={{ height: '34px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
                  >
                    <span className="text-sm tabular font-medium" style={{ color: 'var(--text)' }}>main.tsx</span>
                    <button
                      onClick={() => setPreviewCode(code)}
                      className="press flex items-center gap-1.5 px-3 text-xs font-medium"
                      style={{ height: '22px', color: 'var(--bg)', background: 'var(--green)', boxShadow: '0 0 8px var(--green-dim)' }}
                      title="⌘Enter で即時実行"
                    >
                      <Play size={10} />
                      実行
                    </button>
                  </div>
                  <div
                    key={editorFlashKey}
                    className={`flex-1 overflow-hidden relative ${editorFlashKey > 0 ? 'animate-flash' : ''}`}
                  >
                    <Editor value={code} onChange={setCode} onCursorChange={handleCursorChange} />
                  </div>
                  <div
                    className="flex items-center gap-4 px-4 shrink-0 tabular"
                    style={{ height: '22px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}
                  >
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {cursor.line.toString().padStart(2, '0')}:{cursor.col.toString().padStart(2, '0')}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {lineCount}行 · {charCount}字
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>TSX</span>
                    <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                      ⌘Enter 実行 · ⌘K チャット
                    </span>
                  </div>
                </div>

                {/* Preview */}
                <div className="flex flex-col min-w-0 w-full h-full">
                  <div
                    className="flex items-center justify-between px-4 shrink-0"
                    style={{ height: '34px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
                  >
                    <span className="text-sm font-medium" style={{ color: 'var(--text)', letterSpacing: '0.04em' }}>
                      🌐 Preview
                    </span>
                    <span
                      className="text-xs flex items-center gap-1.5"
                      style={{
                        color:
                          previewStatus.kind === 'error'
                            ? 'var(--red)'
                            : previewStatus.kind === 'compiling'
                            ? 'var(--amber)'
                            : 'var(--text-muted)',
                      }}
                      title={previewStatus.kind === 'error' ? previewStatus.message : undefined}
                    >
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: statusInfo.dot, boxShadow: `0 0 4px ${statusInfo.dot}` }}
                      />
                      <span className="tabular">{statusInfo.detail}</span>
                    </span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {previewCode ? (
                      <Preview code={previewCode} onStatus={setPreviewStatus} />
                    ) : (
                      <div className="h-full flex items-center justify-center" style={{ background: 'var(--surface)' }}>
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          「<span style={{ color: 'var(--green)' }}>実行</span>」またはコード編集で表示
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Splitter>

              {/* Bottom: Console */}
              <Console />
            </Splitter>

            {/* Right: Chat */}
            <ChatPanel
              messages={messages}
              isGenerating={isGenerating}
              onSend={sendMessage}
              onAbort={abortGeneration}
              onApplyCode={applyCode}
              inputRef={chatInputRef}
              modelState={llm.state}
              onPickModel={() => setPickerOpen(true)}
              onSwitchModel={() => setPickerOpen(true)}
              onUnloadModel={llm.unloadModel}
              onCancelLoad={llm.cancelLoad}
              onRetryLoad={retryLoad}
            />
          </Splitter>
        </Splitter>
      </div>

      <ModelPicker
        open={pickerOpen}
        onSelect={handlePickModel}
        onClose={() => setPickerOpen(false)}
        isLoading={llm.state.kind === 'loading'}
        loadProgress={llm.state.kind === 'loading' ? llm.state.progress : 0}
        loadText={llm.state.kind === 'loading' ? llm.state.progressText : ''}
      />
    </div>
  )
}

function Header({
  llmState,
  statusLabel,
  statusDot,
}: {
  llmState: ModelState
  statusLabel: string
  statusDot: string
}) {
  const modelLabel =
    llmState.kind === 'ready' ? llmState.modelName :
    llmState.kind === 'loading' ? `${llmState.modelName} 読込中` :
    llmState.kind === 'error' ? 'エラー' :
    '未選択'
  return (
    <header
      className="flex items-center gap-3 px-4 shrink-0"
      style={{ height: '36px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}
    >
      <div className="flex items-center gap-2">
        <div className="w-3.5 h-3.5 grid grid-cols-2 gap-px">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-sm"
              style={{
                background: i === 1 || i === 2 ? 'var(--amber)' : 'var(--border2)',
                boxShadow: i === 1 || i === 2 ? '0 0 4px var(--amber-glow)' : 'none',
              }}
            />
          ))}
        </div>
        <span className="text-sm font-medium" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
          BROWSER<span style={{ color: 'var(--amber-strong)' }}>IDE</span>
        </span>
      </div>
      <span style={{ color: 'var(--text-dim)' }}>/</span>
      <span className="text-xs truncate tabular" style={{ color: 'var(--text-dim)', maxWidth: '260px' }}>
        {modelLabel}
      </span>
      <span className="ml-auto flex items-center gap-2 text-xs tabular" style={{ color: 'var(--text-dim)' }}>
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{
            background: statusDot,
            boxShadow: `0 0 6px ${statusDot}`,
            transition: 'background 200ms var(--ease)',
          }}
        />
        <span style={{ letterSpacing: '0.08em' }}>{statusLabel}</span>
      </span>
    </header>
  )
}
