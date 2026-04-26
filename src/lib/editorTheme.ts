import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: '#09090b',
    color: '#c4c4cc',
    height: '100%',
    fontSize: '13.5px',
  },
  '.cm-content': {
    caretColor: '#e8a838',
    padding: '8px 0',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#e8a838',
    borderLeftWidth: '2px',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'rgba(232, 168, 56, 0.15)',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(232, 168, 56, 0.18)',
  },
  '.cm-gutters': {
    backgroundColor: '#09090b',
    borderRight: '1px solid #1e1e24',
    color: '#3a3a42',
    minWidth: '48px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: '#6b6b76',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(255,255,255,0.022)',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 14px 0 8px',
    fontSize: '12px',
  },
  '.cm-scroller': {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    lineHeight: '1.7',
    overflow: 'auto',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(232, 168, 56, 0.2)',
    outline: '1px solid rgba(232, 168, 56, 0.35)',
    borderRadius: '2px',
  },
  '.cm-tooltip': {
    background: '#141418',
    border: '1px solid #2a2a32',
    color: '#c4c4cc',
    borderRadius: '3px',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    background: 'rgba(232, 168, 56, 0.15)',
    color: '#e8a838',
  },
  '.cm-foldPlaceholder': {
    background: '#1e1e24',
    border: 'none',
    color: '#6b6b76',
    borderRadius: '2px',
    padding: '0 4px',
  },
  '.cm-searchMatch': {
    background: 'rgba(232, 168, 56, 0.2)',
    outline: '1px solid rgba(232, 168, 56, 0.4)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    background: 'rgba(232, 168, 56, 0.35)',
  },
}, { dark: true })

const highlightStyle = HighlightStyle.define([
  { tag: t.keyword,                    color: '#c084fc' },
  { tag: t.controlKeyword,             color: '#c084fc' },
  { tag: t.moduleKeyword,              color: '#c084fc' },
  { tag: t.operator,                   color: '#94a3b8' },
  { tag: t.special(t.variableName),    color: '#93c5fd' },
  { tag: t.variableName,               color: '#c4c4cc' },
  { tag: t.definition(t.variableName), color: '#93c5fd' },
  { tag: t.function(t.variableName),   color: '#93c5fd' },
  { tag: t.propertyName,               color: '#7dd3fc' },
  { tag: t.attributeName,              color: '#86efac' },
  { tag: t.string,                     color: '#86efac' },
  { tag: t.special(t.string),          color: '#6ee7b7' },
  { tag: t.number,                     color: '#fdba74' },
  { tag: t.bool,                       color: '#c084fc' },
  { tag: t.null,                       color: '#c084fc' },
  { tag: t.comment,                    color: '#4b5563', fontStyle: 'italic' },
  { tag: t.lineComment,                color: '#4b5563', fontStyle: 'italic' },
  { tag: t.blockComment,               color: '#4b5563', fontStyle: 'italic' },
  { tag: t.tagName,                    color: '#f9a8d4' },
  { tag: t.angleBracket,               color: '#6b6b76' },
  { tag: t.typeName,                   color: '#fcd34d' },
  { tag: t.className,                  color: '#fcd34d' },
  { tag: t.typeOperator,               color: '#c084fc' },
  { tag: t.punctuation,                color: '#6b6b76' },
  { tag: t.bracket,                    color: '#94a3b8' },
  { tag: t.regexp,                     color: '#fb923c' },
  { tag: t.escape,                     color: '#fb923c' },
  { tag: t.self,                       color: '#c084fc' },
])

export const editorExtensions = [darkTheme, syntaxHighlighting(highlightStyle)]
