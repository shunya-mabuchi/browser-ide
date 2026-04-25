import { useEffect, useRef } from 'react'
import { initialize as initEsbuild, transform } from 'esbuild-wasm'

let esbuildReady = false

async function ensureEsbuild() {
  if (esbuildReady) return
  await initEsbuild({ wasmURL: 'https://unpkg.com/esbuild-wasm/esbuild.wasm' })
  esbuildReady = true
}

interface Props {
  code: string
}

export function Preview({ code }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        await ensureEsbuild()
        if (cancelled) return

        const result = await transform(code, {
          loader: 'tsx',
          format: 'iife',
          globalName: '__app',
        })

        // srcdoc on a sandboxed iframe is the standard approach for browser-based code sandboxes.
        // sandbox="allow-scripts" prevents the iframe from accessing parent frame, cookies, or storage.
        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>body { margin: 0; font-family: sans-serif; background: #fff; color: #111; }</style>
</head>
<body>
  <div id="root"></div>
  <script>
    window.onerror = function(msg) {
      var pre = document.createElement('pre')
      pre.style.cssText = 'color:red;padding:16px;font-family:monospace'
      pre.textContent = msg
      document.body.appendChild(pre)
    }
    ${result.code}
  </script>
</body>
</html>`

        if (iframeRef.current && !cancelled) {
          iframeRef.current.srcdoc = html
        }
      } catch (err) {
        if (iframeRef.current && !cancelled) {
          const errHtml = `<!DOCTYPE html><html><body><pre style="color:red;padding:16px;font-family:monospace"></pre><script>document.querySelector('pre').textContent=${JSON.stringify(String(err))}</script></body></html>`
          iframeRef.current.srcdoc = errHtml
        }
      }
    }

    run()
    return () => { cancelled = true }
  }, [code])

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts"
      className="w-full h-full border-none bg-white"
      title="preview"
    />
  )
}
