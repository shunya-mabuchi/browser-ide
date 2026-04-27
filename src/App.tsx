import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Editor } from './components/Editor'
import { Preview, type PreviewStatus } from './components/Preview'
import { ChatPanel, type Message } from './components/ChatPanel'
import { ModelPicker } from './components/ModelPicker'
import { Splitter } from './components/Splitter'
import { Console } from './components/Console'
import { FileTreePlaceholder } from './components/FileTreePlaceholder'
import { ActivityBar } from './components/ActivityBar'
import { EditorTabs, type TabKind } from './components/EditorTabs'
import { ResizableHandle } from './components/ResizableHandle'
import { ToastProvider, useToast } from './components/Toast'
import { useLlmModel, type ModelState } from './hooks/useLlmModel'
import { key } from './lib/platform'
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

function readBoolPref(key: string, defaultValue: boolean): boolean {
  const v = localStorage.getItem(key)
  if (v === null) return defaultValue
  return v === 'true'
}

function writeBoolPref(key: string, value: boolean): void {
  localStorage.setItem(key, value ? 'true' : 'false')
}

function readNumPref(key: string, defaultValue: number): number {
  const v = localStorage.getItem(key)
  if (v === null) return defaultValue
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : defaultValue
}

function writeNumPref(key: string, value: number): void {
  localStorage.setItem(key, String(value))
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

const EXPLORER_MIN = 180
const EXPLORER_MAX = 480
const CHAT_MIN = 280
const CHAT_MAX = 640

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

  // Layout state — VS Code-like panel toggles
  const [showExplorer, setShowExplorer] = useState(() => readBoolPref('bide.show.explorer', true))
  const [showChat, setShowChat] = useState(() => readBoolPref('bide.show.chat', true))
  const [showConsole, setShowConsole] = useState(() => readBoolPref('bide.show.console', false))
  const [explorerWidth, setExplorerWidth] = useState(() => readNumPref('bide.width.explorer', 240))
  const [chatWidth, setChatWidth] = useState(() => readNumPref('bide.width.chat', 380))

  // Editor tabs — main.tsx + Preview
  const [activeTab, setActiveTab] = useState<TabKind>('main')
  const [previewOpen, setPreviewOpen] = useState(true)

  const chatInputRef = useRef<HTMLTextAreaElement>(null)
  const lastLoadOptsRef = useRef<{ modelId: string; modelName?: string } | null>(null)

  // Migrate old localStorage keys (one-time, v4 = layout fix era)
  useEffect(() => {
    if (localStorage.getItem('bide.migrated.v4')) return
    for (const k of [
      'bide.split.h', 'bide.split.v',
      'bide.split.tree', 'bide.split.chat', 'bide.split.console', 'bide.split.preview',
      'bide.split.v3.tree', 'bide.split.v3.chat', 'bide.split.v3.console',
      'bide.show.explorer', 'bide.show.chat', 'bide.show.console',
      'bide.migrated.v1', 'bide.migrated.v2', 'bide.migrated.v3',
    ]) {
      localStorage.removeItem(k)
    }
    localStorage.setItem('bide.migrated.v4', 'true')
  }, [])

  // Persist panel toggles
  useEffect(() => writeBoolPref('bide.show.explorer', showExplorer), [showExplorer])
  useEffect(() => writeBoolPref('bide.show.chat', showChat), [showChat])
  useEffect(() => writeBoolPref('bide.show.console', showConsole), [showConsole])
  useEffect(() => writeNumPref('bide.width.explorer', explorerWidth), [explorerWidth])
  useEffect(() => writeNumPref('bide.width.chat', chatWidth), [chatWidth])

  // Auto-preview (1.5s debounce)
  useEffect(() => {
    const timer = setTimeout(() => setPreviewCode(code), 1500)
    return () => clearTimeout(timer)
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

  const runPreview = useCallback(() => {
    setPreviewCode(code)
    setPreviewOpen(true)
    setActiveTab('preview')
  }, [code])

  // Global shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'Enter') {
        e.preventDefault()
        runPreview()
      } else if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        if (!showChat) setShowChat(true)
        chatInputRef.current?.focus()
      } else if (mod && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault()
        setShowExplorer((v) => !v)
      } else if (mod && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault()
        setShowConsole((v) => !v)
      } else if (mod && e.key === '\\') {
        e.preventDefault()
        setShowChat((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [runPreview, showChat])

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
    setActiveTab('main')
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

  const handleSelectTab = useCallback((tab: TabKind) => {
    if (tab === 'preview' && !previewOpen) setPreviewOpen(true)
    setActiveTab(tab)
  }, [previewOpen])

  const closePreviewTab = useCallback(() => {
    setPreviewOpen(false)
    setActiveTab('main')
  }, [])

  const statusInfo = useMemo(() => {
    switch (previewStatus.kind) {
      case 'compiling': return { dot: 'var(--amber)', label: 'compile', detail: 'コンパイル中' }
      case 'ok': return { dot: 'var(--green)', label: 'ok', detail: 'OK' }
      case 'error': return { dot: 'var(--red)', label: 'error', detail: previewStatus.message }
      default: return { dot: 'var(--text-muted)', label: 'idle', detail: '待機中' }
    }
  }, [previewStatus])

  const lineCount = useMemo(() => code.split('\n').length, [code])
  const charCount = code.length

  const editorArea = (
    <EditorArea
      activeTab={activeTab}
      previewOpen={previewOpen}
      onSelectTab={handleSelectTab}
      onClosePreview={closePreviewTab}
      onRun={runPreview}
      code={code}
      onCodeChange={setCode}
      onCursorChange={handleCursorChange}
      cursor={cursor}
      lineCount={lineCount}
      charCount={charCount}
      previewCode={previewCode}
      onPreviewStatus={setPreviewStatus}
      editorFlashKey={editorFlashKey}
      statusInfo={statusInfo}
    />
  )

  // Center area renders editor area + console (if shown)
  const centerArea = showConsole ? (
    <Splitter storageKey="bide.split.v4.console" defaultPercent={70} min={30} max={85} orientation="horizontal">
      {editorArea}
      <Console onClose={() => setShowConsole(false)} />
    </Splitter>
  ) : editorArea

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)' }}>
      <Header llmState={llm.state} statusLabel={statusInfo.label} statusDot={statusInfo.dot} />

      <div className="flex flex-1 overflow-hidden">
        <ActivityBar
          showExplorer={showExplorer}
          showChat={showChat}
          showConsole={showConsole}
          onToggleExplorer={() => setShowExplorer((v) => !v)}
          onToggleChat={() => setShowChat((v) => !v)}
          onToggleConsole={() => setShowConsole((v) => !v)}
        />

        {showExplorer && (
          <>
            <div
              className="overflow-hidden flex shrink-0"
              style={{ width: explorerWidth, minWidth: 0 }}
            >
              <FileTreePlaceholder onClose={() => setShowExplorer(false)} />
            </div>
            <ResizableHandle
              orientation="vertical"
              onResize={(dx) => setExplorerWidth((w) => clamp(w + dx, EXPLORER_MIN, EXPLORER_MAX))}
            />
          </>
        )}

        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {centerArea}
        </div>

        {showChat && (
          <>
            <ResizableHandle
              orientation="vertical"
              onResize={(dx) => setChatWidth((w) => clamp(w - dx, CHAT_MIN, CHAT_MAX))}
            />
            <div
              className="overflow-hidden flex shrink-0"
              style={{ width: chatWidth, minWidth: 0 }}
            >
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
            </div>
          </>
        )}
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

type EditorAreaProps = {
  activeTab: TabKind
  previewOpen: boolean
  onSelectTab: (tab: TabKind) => void
  onClosePreview: () => void
  onRun: () => void
  code: string
  onCodeChange: (s: string) => void
  onCursorChange: (line: number, col: number) => void
  cursor: { line: number; col: number }
  lineCount: number
  charCount: number
  previewCode: string
  onPreviewStatus: (s: PreviewStatus) => void
  editorFlashKey: number
  statusInfo: { dot: string; label: string; detail: string }
}

function EditorArea(props: EditorAreaProps) {
  return (
    <div className="flex flex-col h-full w-full min-w-0 min-h-0">
      <EditorTabs
        active={props.activeTab}
        previewOpen={props.previewOpen}
        onSelect={props.onSelectTab}
        onClosePreview={props.onClosePreview}
        onRun={props.onRun}
      />

      {props.activeTab === 'main' && (
        <>
          <div
            key={props.editorFlashKey}
            className={`flex-1 min-h-0 overflow-hidden relative ${props.editorFlashKey > 0 ? 'animate-flash' : ''}`}
          >
            <Editor value={props.code} onChange={props.onCodeChange} onCursorChange={props.onCursorChange} />
          </div>
          <div
            className="flex items-center gap-4 px-4 shrink-0 tabular"
            style={{ height: '22px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}
          >
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {props.cursor.line.toString().padStart(2, '0')}:{props.cursor.col.toString().padStart(2, '0')}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {props.lineCount}行 · {props.charCount}字
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>TSX</span>
            <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
              {key('Mod', 'B')} Explorer · {key('Mod', 'J')} Console · {key('Mod', '\\')} Chat
            </span>
          </div>
        </>
      )}

      {props.activeTab === 'preview' && props.previewOpen && (
        <>
          <div className="flex-1 min-h-0 overflow-hidden">
            {props.previewCode ? (
              <Preview code={props.previewCode} onStatus={props.onPreviewStatus} />
            ) : (
              <div className="h-full flex items-center justify-center" style={{ background: 'var(--surface)' }}>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  「<span style={{ color: 'var(--green)' }}>実行</span>」またはコード編集で表示
                </span>
              </div>
            )}
          </div>
          <div
            className="flex items-center gap-3 px-4 shrink-0 tabular"
            style={{ height: '22px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: props.statusInfo.dot, boxShadow: `0 0 4px ${props.statusInfo.dot}` }}
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{props.statusInfo.detail}</span>
            <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
              {key('Mod', 'Enter')} で再実行
            </span>
          </div>
        </>
      )}
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
      <span className="text-xs truncate tabular" style={{ color: 'var(--text-muted)', maxWidth: '260px' }}>
        {modelLabel}
      </span>
      <span className="ml-auto flex items-center gap-2 text-xs tabular" style={{ color: 'var(--text-muted)' }}>
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
