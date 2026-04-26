import { useEffect, useRef, useState } from 'react'

interface Props {
  storageKey: string
  defaultPercent: number
  min?: number
  max?: number
  orientation?: 'vertical' | 'horizontal'
  children: [React.ReactNode, React.ReactNode]
}

const HANDLE = 4

export function Splitter({
  storageKey,
  defaultPercent,
  min = 20,
  max = 80,
  orientation = 'vertical',
  children,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const [percent, setPercent] = useState<number>(() => {
    if (typeof window === 'undefined') return defaultPercent
    const stored = window.localStorage.getItem(storageKey)
    const n = stored ? parseFloat(stored) : NaN
    return Number.isFinite(n) ? clamp(n, min, max) : defaultPercent
  })

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const next =
        orientation === 'vertical'
          ? ((e.clientX - rect.left) / rect.width) * 100
          : ((e.clientY - rect.top) / rect.height) * 100
      setPercent(clamp(next, min, max))
    }
    const onUp = () => {
      if (!draggingRef.current) return
      draggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [orientation, min, max])

  useEffect(() => {
    window.localStorage.setItem(storageKey, String(percent))
  }, [percent, storageKey])

  const start = () => {
    draggingRef.current = true
    document.body.style.cursor = orientation === 'vertical' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
  }

  const isV = orientation === 'vertical'
  return (
    <div
      ref={containerRef}
      className={`flex w-full h-full overflow-hidden ${isV ? 'flex-row' : 'flex-col'}`}
    >
      <div className="overflow-hidden flex" style={{ flex: `0 0 ${percent}%`, minWidth: 0, minHeight: 0 }}>
        {children[0]}
      </div>
      <div
        onMouseDown={start}
        className="shrink-0 relative group"
        style={{
          [isV ? 'width' : 'height']: `${HANDLE}px`,
          cursor: isV ? 'col-resize' : 'row-resize',
          background: 'var(--border)',
          transition: 'background 150ms var(--ease)',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--amber-mute)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--border)' }}
      />
      <div className="overflow-hidden flex flex-1" style={{ minWidth: 0, minHeight: 0 }}>
        {children[1]}
      </div>
    </div>
  )
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}
