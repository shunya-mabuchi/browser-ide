import { useEffect, useRef } from 'react'

type Props = {
  orientation: 'vertical' | 'horizontal'
  onResize: (delta: number) => void
}

const HANDLE_THICKNESS = 4

export function ResizableHandle({ orientation, onResize }: Props) {
  const draggingRef = useRef(false)
  const lastPosRef = useRef(0)
  const onResizeRef = useRef(onResize)

  useEffect(() => {
    onResizeRef.current = onResize
  }, [onResize])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      const current = orientation === 'vertical' ? e.clientX : e.clientY
      const delta = current - lastPosRef.current
      lastPosRef.current = current
      if (delta !== 0) onResizeRef.current(delta)
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
  }, [orientation])

  const start = (e: React.MouseEvent) => {
    draggingRef.current = true
    lastPosRef.current = orientation === 'vertical' ? e.clientX : e.clientY
    document.body.style.cursor = orientation === 'vertical' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div
      onMouseDown={start}
      className="shrink-0"
      style={{
        [orientation === 'vertical' ? 'width' : 'height']: HANDLE_THICKNESS,
        cursor: orientation === 'vertical' ? 'col-resize' : 'row-resize',
        background: 'var(--border)',
        transition: 'background 150ms var(--ease)',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--amber-mute)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--border)' }}
    />
  )
}
