import { createContext, useCallback, useContext, useState, useRef, type ReactNode } from 'react'

type ToastKind = 'info' | 'warn' | 'error' | 'success'

type Toast = {
  id: number
  kind: ToastKind
  message: string
}

type ToastContextValue = {
  show: (kind: ToastKind, message: string, durationMs?: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)

  const show = useCallback((kind: ToastKind, message: string, durationMs = 4000) => {
    const id = ++idRef.current
    setToasts((prev) => [...prev, { id, kind, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, durationMs)
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 1000,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              pointerEvents: 'auto',
              padding: '10px 14px',
              borderRadius: 4,
              fontSize: 13,
              minWidth: 280,
              maxWidth: 420,
              border: '1px solid var(--border)',
              background: 'var(--surface2)',
              color: colorFor(t.kind),
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}
          >
            <span style={{ marginRight: 8 }}>{iconFor(t.kind)}</span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function colorFor(kind: ToastKind): string {
  switch (kind) {
    case 'error': return 'var(--red)'
    case 'warn': return 'var(--amber)'
    case 'success': return 'var(--green)'
    default: return 'var(--text)'
  }
}

function iconFor(kind: ToastKind): string {
  switch (kind) {
    case 'error': return '✗'
    case 'warn': return '⚠'
    case 'success': return '✓'
    default: return 'ℹ'
  }
}
