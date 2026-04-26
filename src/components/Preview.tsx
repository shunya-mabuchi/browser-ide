import { useEffect, useRef, useState } from 'react'
import { initialize as initEsbuild, transform } from 'esbuild-wasm'

let esbuildPromise: Promise<void> | null = null
let reactText: string | null = null
let reactDomText: string | null = null
let reactLoadPromise: Promise<void> | null = null

function ensureEsbuild() {
  if (!esbuildPromise) {
    esbuildPromise = initEsbuild({ wasmURL: 'https://unpkg.com/esbuild-wasm/esbuild.wasm' })
  }
  return esbuildPromise
}

function ensureReact() {
  if (reactText && reactDomText) return Promise.resolve()
  if (!reactLoadPromise) {
    reactLoadPromise = Promise.all([
      fetch('https://unpkg.com/react@18/umd/react.production.min.js').then((r) => r.text()),
      fetch('https://unpkg.com/react-dom@18/umd/react-dom.production.min.js').then((r) => r.text()),
    ]).then(([r, rd]) => {
      reactText = r
      reactDomText = rd
    })
  }
  return reactLoadPromise
}

function safeScript(code: string) {
  return code.replace(/<\/script/gi, '<\\/script')
}

// Bootstrap HTML — written once into the iframe's srcDoc.
// Subsequent code updates are applied via postMessage; the iframe itself is
// preserved so scroll position, focus and form state survive between runs.
function buildBootstrapHtml() {
  const react = reactText!
  const reactDom = reactDomText!

  // The user's transformed code is loaded as an ESM module via Blob URL each
  // run. Each module gets a fresh top-level scope, so var/let/const/function
  // declarations of the same name can be re-evaluated indefinitely.
  const receiver =
    'var __root=null;' +
    'var __lastUrl=null;' +
    'function __clearHost(host){while(host.firstChild)host.removeChild(host.firstChild);}' +
    'function __mount(code){' +
      'var host=document.getElementById("root");' +
      'var wrapped=code+"\\nglobalThis.App=(typeof App!==\\"undefined\\"?App:null);";' +
      'var blob=new Blob([wrapped],{type:"application/javascript"});' +
      'var url=URL.createObjectURL(blob);' +
      'import(url).then(function(){' +
        'var AppFn=globalThis.App;' +
        'try{' +
          'if(__root){__root.unmount();__root=null;}' +
          '__clearHost(host);' +
          'if(AppFn){' +
            '__root=ReactDOM.createRoot(host);' +
            '__root.render(React.createElement(AppFn));' +
            'parent.postMessage({source:"browser-ide-preview",type:"ok"},"*");' +
          '}else{' +
            '__renderNotice("App コンポーネントが定義されていません","#a87c2e");' +
            'parent.postMessage({source:"browser-ide-preview",type:"warn",message:"App not defined"},"*");' +
          '}' +
        '}catch(e){' +
          '__renderNotice(e&&e.stack||String(e),"#d96868");' +
          'parent.postMessage({source:"browser-ide-preview",type:"error",message:String(e&&e.message||e)},"*");' +
        '}' +
        'if(__lastUrl)URL.revokeObjectURL(__lastUrl);' +
        '__lastUrl=url;' +
      '}).catch(function(e){' +
        '__renderNotice(e&&e.stack||String(e),"#d96868");' +
        'parent.postMessage({source:"browser-ide-preview",type:"error",message:String(e&&e.message||e)},"*");' +
      '});' +
    '}' +
    'function __renderNotice(text,color){' +
      'var host=document.getElementById("root");if(!host)return;' +
      '__clearHost(host);' +
      'var p=document.createElement("pre");' +
      'p.style.cssText="color:"+color+";padding:16px;font-family:ui-monospace,monospace;font-size:12px;white-space:pre-wrap;margin:0";' +
      'p.textContent=text;' +
      'host.appendChild(p);' +
    '}' +
    'window.onerror=function(m,s,l,c,e){__renderNotice(e&&e.stack||String(m),"#d96868");' +
      'parent.postMessage({source:"browser-ide-preview",type:"error",message:String(m)},"*");' +
    'return true;};' +
    'window.addEventListener("message",function(ev){' +
      'var d=ev.data;if(!d||d.source!=="browser-ide-host")return;' +
      'if(d.type==="run")__mount(d.code);' +
    '});' +
    'parent.postMessage({source:"browser-ide-preview",type:"ready"},"*");'

  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<style>' +
      'html,body{margin:0;background:#fff;color:#111}' +
      'body{font-family:system-ui,sans-serif}' +
      '#root{min-height:100vh}' +
    '</style>' +
    '</head><body><div id="root"></div>' +
    '<script>' + safeScript(react) + '<' + '/script>' +
    '<script>' + safeScript(reactDom) + '<' + '/script>' +
    '<script>' + receiver + '<' + '/script>' +
    '</body></html>'
  )
}

export type PreviewStatus =
  | { kind: 'idle' }
  | { kind: 'compiling' }
  | { kind: 'ok'; ranAt: number }
  | { kind: 'error'; message: string }

interface Props {
  code: string
  onStatus?: (status: PreviewStatus) => void
}

export function Preview({ code, onStatus }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const readyRef = useRef(false)
  const pendingRef = useRef<string | null>(null)
  const [bootHtml, setBootHtml] = useState<string | null>(null)
  const [flashKey, setFlashKey] = useState(0)
  const onStatusRef = useRef(onStatus)
  useEffect(() => { onStatusRef.current = onStatus }, [onStatus])

  // Boot the iframe once: prepare bootstrap HTML and listen for messages.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await Promise.all([ensureEsbuild(), ensureReact()])
      if (cancelled) return
      setBootHtml(buildBootstrapHtml())
    })()

    const handler = (ev: MessageEvent) => {
      const d = ev.data
      if (!d || d.source !== 'browser-ide-preview') return
      if (d.type === 'ready') {
        readyRef.current = true
        if (pendingRef.current !== null) {
          iframeRef.current?.contentWindow?.postMessage(
            { source: 'browser-ide-host', type: 'run', code: pendingRef.current },
            '*',
          )
          pendingRef.current = null
        }
      } else if (d.type === 'ok') {
        onStatusRef.current?.({ kind: 'ok', ranAt: Date.now() })
        setFlashKey((n) => n + 1)
      } else if (d.type === 'error' || d.type === 'warn') {
        onStatusRef.current?.({ kind: 'error', message: d.message })
      }
    }
    window.addEventListener('message', handler)
    return () => {
      cancelled = true
      window.removeEventListener('message', handler)
    }
  }, [])

  // When code changes: transform + send via postMessage. Do NOT recreate the iframe.
  useEffect(() => {
    if (!bootHtml) return
    let cancelled = false

    ;(async () => {
      onStatusRef.current?.({ kind: 'compiling' })
      try {
        // No `format` — keep top-level declarations so the ESM Blob module
        // inside the iframe can pick up `function App` / `const App` / `let App`.
        const result = await transform(code, { loader: 'tsx' })
        if (cancelled) return

        if (readyRef.current && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            { source: 'browser-ide-host', type: 'run', code: result.code },
            '*',
          )
        } else {
          pendingRef.current = result.code
        }
      } catch (err: any) {
        if (cancelled) return
        onStatusRef.current?.({ kind: 'error', message: String(err?.message || err) })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [code, bootHtml])

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface)' }}>
      {/* faux address bar — frames the white viewport so it doesn't float */}
      <div
        className="flex items-center gap-2 px-3 shrink-0"
        style={{ height: '24px', borderBottom: '1px solid var(--border)', background: 'var(--surface3)' }}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--border2)' }} />
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--border2)' }} />
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--border2)' }} />
        </div>
        <div
          className="flex-1 px-2 text-xs tabular truncate flex items-center"
          style={{
            color: 'var(--text-dim)',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            height: '14px',
            borderRadius: '2px',
          }}
        >
          localhost / preview
        </div>
      </div>

      <div className="relative flex-1 bezel">
        {bootHtml ? (
          <iframe
            ref={iframeRef}
            srcDoc={bootHtml}
            sandbox="allow-scripts"
            className="w-full h-full border-none"
            style={{ background: '#fff' }}
            title="preview"
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <span className="text-xs tabular" style={{ color: 'var(--text-dim)' }}>
              Preview を初期化中<span className="cursor-blink">_</span>
            </span>
          </div>
        )}
        {flashKey > 0 && (
          <div
            key={flashKey}
            className="pointer-events-none absolute inset-0 animate-flash"
          />
        )}
      </div>
    </div>
  )
}
