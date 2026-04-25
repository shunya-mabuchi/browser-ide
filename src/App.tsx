import { useState, useRef, useCallback } from 'react'
import { Play } from 'lucide-react'
import { Editor } from './components/Editor'
import { Preview } from './components/Preview'
import { ChatPanel, type Message } from './components/ChatPanel'
import { ModelSelector } from './components/ModelSelector'
import './index.css'

const DEFAULT_CODE = `function App() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Hello, BrowserIDE!</h1>
      <p>コードを編集して Run を押してください。</p>
    </div>
  )
}
`

type AppState = 'model-select' | 'ready'

export default function App() {
  const [appState, setAppState] = useState<AppState>('model-select')
  const [code, setCode] = useState(DEFAULT_CODE)
  const [previewCode, setPreviewCode] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoadingModel, setIsLoadingModel] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)
  const [loadText, setLoadText] = useState('')

  const workerRef = useRef<Worker | null>(null)

  const loadModel = useCallback((modelId: string) => {
    setIsLoadingModel(true)

    const worker = new Worker(new URL('./workers/llm.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker

    worker.onmessage = (e) => {
      const msg = e.data
      if (msg.type === 'progress') {
        setLoadProgress(msg.progress)
        setLoadText(msg.text)
      } else if (msg.type === 'done') {
        setIsLoadingModel(false)
        setAppState('ready')
      } else if (msg.type === 'error') {
        setIsLoadingModel(false)
        alert(`モデルの読み込みに失敗しました: ${msg.message}`)
      }
    }

    worker.postMessage({ type: 'load', modelId })
  }, [])

  const sendMessage = useCallback((text: string) => {
    if (!workerRef.current) return

    const userMsg: Message = { role: 'user', content: text }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setIsGenerating(true)

    const assistantMsg: Message = { role: 'assistant', content: '' }
    setMessages([...updatedMessages, assistantMsg])

    workerRef.current.onmessage = (e) => {
      const msg = e.data
      if (msg.type === 'chunk') {
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = {
            ...next[next.length - 1],
            content: next[next.length - 1].content + msg.delta,
          }
          return next
        })
      } else if (msg.type === 'done') {
        setIsGenerating(false)
      } else if (msg.type === 'error') {
        setIsGenerating(false)
      }
    }

    workerRef.current.postMessage({
      type: 'chat',
      messages: [
        {
          role: 'system',
          content: 'あなたはコーディングアシスタントです。コードはMarkdownのコードブロック（```tsx）で返してください。',
        },
        ...updatedMessages.map((m) => ({ role: m.role, content: m.content })),
      ],
    })
  }, [messages])

  const abortGeneration = useCallback(() => {
    workerRef.current?.postMessage({ type: 'abort' })
    setIsGenerating(false)
  }, [])

  const applyCode = useCallback((newCode: string) => {
    setCode(newCode)
  }, [])

  if (appState === 'model-select') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-100">BrowserIDE</h1>
          <p className="text-sm text-gray-500 mt-1">完全ブラウザ完結 · プライバシー保護 · 永続無料</p>
        </div>
        <ModelSelector
          onSelect={loadModel}
          isLoading={isLoadingModel}
          loadProgress={loadProgress}
          loadText={loadText}
        />
      </div>
    )
  }

  return (
    <div className="h-full flex">
      {/* 左: エディタ */}
      <div className="flex-1 flex flex-col border-r border-gray-800 min-w-0">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800 bg-gray-900/50">
          <span className="text-xs text-gray-500">main.tsx</span>
          <button
            onClick={() => setPreviewCode(code)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-green-700 hover:bg-green-600 text-white text-xs font-medium transition-colors"
          >
            <Play size={11} />
            Run
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <Editor value={code} onChange={setCode} />
        </div>
      </div>

      {/* 右: プレビュー + チャット */}
      <div className="w-[420px] flex flex-col shrink-0">
        <div className="h-1/2 border-b border-gray-800">
          {previewCode ? (
            <Preview code={previewCode} />
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-gray-600">
              Run を押すとプレビューが表示されます
            </div>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatPanel
            messages={messages}
            isGenerating={isGenerating}
            onSend={sendMessage}
            onAbort={abortGeneration}
            onApplyCode={applyCode}
          />
        </div>
      </div>
    </div>
  )
}
