import { useEffect, useRef } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { basicSetup } from 'codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { editorExtensions } from '../lib/editorTheme'

interface Props {
  value: string
  onChange: (value: string) => void
  onCursorChange?: (line: number, col: number) => void
}

export function Editor({ value, onChange, onCursorChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onCursorRef = useRef(onCursorChange)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { onCursorRef.current = onCursorChange }, [onCursorChange])

  useEffect(() => {
    if (!containerRef.current) return

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          javascript({ jsx: true, typescript: true }),
          ...editorExtensions,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString())
            }
            if ((update.docChanged || update.selectionSet) && onCursorRef.current) {
              const pos = update.state.selection.main.head
              const line = update.state.doc.lineAt(pos)
              onCursorRef.current(line.number, pos - line.from + 1)
            }
          }),
        ],
      }),
      parent: containerRef.current,
    })

    viewRef.current = view
    return () => view.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      })
    }
  }, [value])

  return <div ref={containerRef} className="h-full w-full overflow-hidden" />
}
