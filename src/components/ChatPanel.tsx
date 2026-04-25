import { useState, useRef, useEffect } from 'react'
import { Send, Square } from 'lucide-react'

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
}

function extractCodeBlock(text: string): string | null {
  const match = text.match(/```(?:\w+)?\n([\s\S]+?)```/)
  return match ? match[1].trim() : null
}

export function ChatPanel({ messages, isGenerating, onSend, onAbort, onApplyCode }: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = () => {
    if (!input.trim() || isGenerating) return
    onSend(input.trim())
    setInput('')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`rounded-lg px-3 py-2 text-xs max-w-[85%] whitespace-pre-wrap leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-violet-600 text-white'
                  : 'bg-gray-800 text-gray-200'
              }`}
            >
              {msg.content}
            </div>
            {msg.role === 'assistant' && extractCodeBlock(msg.content) && (
              <button
                onClick={() => onApplyCode(extractCodeBlock(msg.content)!)}
                className="text-xs px-2 py-0.5 rounded bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors"
              >
                エディタに適用
              </button>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-800 p-2 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder="AIに質問する..."
          rows={2}
          className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 resize-none outline-none focus:border-violet-500 transition-colors placeholder-gray-600"
        />
        {isGenerating ? (
          <button
            onClick={onAbort}
            className="p-2 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors self-end"
          >
            <Square size={14} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="p-2 rounded bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors self-end"
          >
            <Send size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
