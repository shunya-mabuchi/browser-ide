import { useEffect } from 'react'
import { ModelSelector } from './ModelSelector'

type Props = {
  open: boolean
  onSelect: (modelId: string, displayName?: string) => void
  onClose: () => void
  isLoading: boolean
  loadProgress: number
  loadText: string
}

export function ModelPicker({ open, onSelect, onClose, isLoading, loadProgress, loadText }: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: 'min(900px, 92vw)',
          maxHeight: '90vh',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <ModelSelector
          isModal
          onSelect={onSelect}
          onCancel={onClose}
          isLoading={isLoading}
          loadProgress={loadProgress}
          loadText={loadText}
        />
      </div>
    </div>
  )
}
