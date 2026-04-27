# Week 1: LLM ライフサイクル再設計 + 4 ペイン基盤 — 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LLM ゲート画面を廃止してエディタ即時表示にする。WebGPU 検出 + WASM フォールバックを正式対応。4 ペインレイアウトの基盤を構築（FileTree とコンソールは placeholder で OK）。

**Architecture:** LLM のライフサイクルを `useLlmModel` フックに抽出し、`AppState` ゲートを撤去する。`ChatPanel` を 4 状態（idle / loading / ready / error）の UI に。`llm.worker.ts` を `device` 引数化して `hardware.ts` と接続。レイアウトは縦 Splitter を追加して 4 軸構成にする。

**Tech Stack:** React 19, TypeScript, CodeMirror 6（既存）, `@huggingface/transformers` v4, Vitest + jsdom + @testing-library/react（新規）, Vite, Tailwind v4

**対応する spec**: [2026-04-27-multi-pane-ide-redesign-design.md](../specs/2026-04-27-multi-pane-ide-redesign-design.md) のセクション 1（レイアウト）+ 6（起動シーケンス）

---

## ファイル構成（Week 1 で触る範囲）

| 種別 | パス | 責務 |
|---|---|---|
| 新規 | `src/lib/llmDevice.ts` | device + dtype の選択ロジック（純関数） |
| 新規 | `src/lib/storage.ts` | localStorage の型安全ラッパ |
| 新規 | `src/components/Toast.tsx` | トースト通知コンポーネント + Provider |
| 新規 | `src/hooks/useLlmModel.ts` | LLM ライフサイクルフック |
| 新規 | `src/components/ModelPicker.tsx` | ModelSelector のモーダルラッパ |
| 新規 | `src/components/FileTreePlaceholder.tsx` | 左ペインの placeholder |
| 新規 | `src/components/Console.tsx` | 下端コンソールパネル skeleton |
| 修正 | `src/workers/llm.worker.ts` | device 引数追加 |
| 修正 | `src/components/ModelSelector.tsx` | `isModal` プロパティ対応 |
| 修正 | `src/components/ChatPanel.tsx` | 4 状態 UI 化 |
| 修正 | `src/components/Splitter.tsx` | `orientation="horizontal"` 対応強化 |
| 修正 | `src/App.tsx` | 4 ペインレイアウト + AppState ゲート撤去 |
| 修正 | `vite.config.ts` | Vitest 設定追加 |
| 修正 | `package.json` | テスト依存とスクリプト追加 |
| 新規 | `vitest.setup.ts` | jsdom 環境のセットアップ |
| 新規 | `src/lib/__tests__/llmDevice.test.ts` | 単体テスト |
| 新規 | `src/lib/__tests__/storage.test.ts` | 単体テスト |

---

## Task 1: テスト基盤のセットアップ

**Files:**
- Modify: `package.json`
- Create: `vitest.setup.ts`
- Modify: `vite.config.ts`

- [ ] **Step 1: Vitest 関連の依存を追加**

```bash
cd /Users/shunya.mabuchi/Projects/browser-ide
npm install -D vitest@^2 jsdom@^25 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14
```

期待される結果: `package.json` の `devDependencies` に上記 5 パッケージが追加される。

- [ ] **Step 2: `vitest.setup.ts` を作成**

```ts
// vitest.setup.ts
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
```

- [ ] **Step 3: `vite.config.ts` に test 設定を追加**

`vite.config.ts` を以下の通り修正（`/// <reference types="vitest" />` を冒頭追加、`test` ブロックを追加、`optimizeDeps.exclude` から旧 `@mlc-ai/web-llm` を除去）:

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 50 * 1024 * 1024,
      },
      manifest: {
        name: 'BrowserIDE',
        short_name: 'BrowserIDE',
        description: 'AI-powered IDE that runs entirely in your browser',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  worker: {
    format: 'es',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
})
```

- [ ] **Step 4: `package.json` に test スクリプト追加**

`scripts` セクションに以下を追加:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

- [ ] **Step 5: スモークテスト**

```bash
npx vitest run
```

期待される出力: `No test files found, exiting with code 1`（テストファイル未作成のため）。これは正常。

- [ ] **Step 6: コミット**

```bash
git add package.json package-lock.json vite.config.ts vitest.setup.ts
git commit -m "chore: Vitest + Testing Library のテスト基盤を導入"
```

---

## Task 2: `llmDevice.ts` の作成（device + dtype 選択ロジック）

**Files:**
- Create: `src/lib/llmDevice.ts`
- Test: `src/lib/__tests__/llmDevice.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/__tests__/llmDevice.test.ts` を作成:

```ts
import { describe, it, expect } from 'vitest'
import { selectDevice, selectDtype, type Dtype } from '../llmDevice'
import type { HardwareInfo } from '../hardware'

const hwBase: HardwareInfo = {
  hasWebGPU: false,
  gpuVendor: null,
  gpuDevice: null,
  maxBufferSizeGB: null,
  deviceMemoryGB: null,
  tier: 'cpu-only',
}

describe('selectDevice', () => {
  it('WebGPU 利用可なら "webgpu"', () => {
    expect(selectDevice({ ...hwBase, hasWebGPU: true })).toBe('webgpu')
  })

  it('WebGPU 非対応なら "wasm"', () => {
    expect(selectDevice({ ...hwBase, hasWebGPU: false })).toBe('wasm')
  })
})

describe('selectDtype', () => {
  it('webgpu + 既定 dtype 指定なし → "q4f16"', () => {
    expect(selectDtype('webgpu', undefined)).toBe('q4f16' as Dtype)
  })

  it('wasm + 既定 dtype 指定なし → "q4"', () => {
    expect(selectDtype('wasm', undefined)).toBe('q4' as Dtype)
  })

  it('wasm + モデル側で q4f16 指定 → q4 にオーバーライド', () => {
    expect(selectDtype('wasm', 'q4f16')).toBe('q4' as Dtype)
  })

  it('webgpu + モデル側で int8 指定 → そのまま int8', () => {
    expect(selectDtype('webgpu', 'int8')).toBe('int8' as Dtype)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npx vitest run src/lib/__tests__/llmDevice.test.ts
```

期待される出力: モジュール解決エラー（`Cannot find module '../llmDevice'`）

- [ ] **Step 3: `src/lib/llmDevice.ts` を実装**

```ts
import type { HardwareInfo } from './hardware'

export type Device = 'webgpu' | 'wasm'
export type Dtype = 'q4f16' | 'q4' | 'fp16' | 'int8'

export function selectDevice(hw: HardwareInfo): Device {
  return hw.hasWebGPU ? 'webgpu' : 'wasm'
}

export function selectDtype(device: Device, requested: Dtype | undefined): Dtype {
  if (device === 'wasm') {
    if (requested === 'q4f16' || requested === 'fp16') return 'q4'
    return requested ?? 'q4'
  }
  return requested ?? 'q4f16'
}
```

- [ ] **Step 4: テストを実行して成功を確認**

```bash
npx vitest run src/lib/__tests__/llmDevice.test.ts
```

期待される出力: 4 件すべてパス。

- [ ] **Step 5: コミット**

```bash
git add src/lib/llmDevice.ts src/lib/__tests__/llmDevice.test.ts
git commit -m "feat: LLM の device + dtype 選択ロジックを追加"
```

---

## Task 3: `storage.ts` の作成（localStorage の型安全ラッパ）

**Files:**
- Create: `src/lib/storage.ts`
- Test: `src/lib/__tests__/storage.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/__tests__/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { storage } from '../storage'

beforeEach(() => {
  localStorage.clear()
})

describe('storage.lastModel', () => {
  it('未設定なら null', () => {
    expect(storage.lastModel.get()).toBeNull()
  })

  it('set した値が get で取れる', () => {
    storage.lastModel.set('onnx-community/Qwen2.5-Coder-7B-Instruct')
    expect(storage.lastModel.get()).toBe('onnx-community/Qwen2.5-Coder-7B-Instruct')
  })

  it('clear で削除される', () => {
    storage.lastModel.set('test-model')
    storage.lastModel.clear()
    expect(storage.lastModel.get()).toBeNull()
  })
})

describe('storage.autoLoadModel', () => {
  it('未設定なら true（既定）', () => {
    expect(storage.autoLoadModel.get()).toBe(true)
  })

  it('false に設定できる', () => {
    storage.autoLoadModel.set(false)
    expect(storage.autoLoadModel.get()).toBe(false)
  })
})

describe('storage.autoDiff', () => {
  it('未設定なら true（既定）', () => {
    expect(storage.autoDiff.get()).toBe(true)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npx vitest run src/lib/__tests__/storage.test.ts
```

期待: `Cannot find module '../storage'`

- [ ] **Step 3: `src/lib/storage.ts` を実装**

```ts
const KEY = {
  lastModel: 'bide.lastModel',
  autoLoadModel: 'bide.autoLoadModel',
  autoDiff: 'bide.autoDiff',
} as const

function getString(key: string): string | null {
  return localStorage.getItem(key)
}

function setString(key: string, value: string): void {
  localStorage.setItem(key, value)
}

function getBool(key: string, defaultValue: boolean): boolean {
  const raw = localStorage.getItem(key)
  if (raw === null) return defaultValue
  return raw === 'true'
}

function setBool(key: string, value: boolean): void {
  localStorage.setItem(key, value ? 'true' : 'false')
}

export const storage = {
  lastModel: {
    get: (): string | null => getString(KEY.lastModel),
    set: (modelId: string): void => setString(KEY.lastModel, modelId),
    clear: (): void => localStorage.removeItem(KEY.lastModel),
  },
  autoLoadModel: {
    get: (): boolean => getBool(KEY.autoLoadModel, true),
    set: (value: boolean): void => setBool(KEY.autoLoadModel, value),
  },
  autoDiff: {
    get: (): boolean => getBool(KEY.autoDiff, true),
    set: (value: boolean): void => setBool(KEY.autoDiff, value),
  },
}
```

- [ ] **Step 4: テストを実行して成功を確認**

```bash
npx vitest run src/lib/__tests__/storage.test.ts
```

期待: 5 件パス。

- [ ] **Step 5: コミット**

```bash
git add src/lib/storage.ts src/lib/__tests__/storage.test.ts
git commit -m "feat: localStorage の型安全ラッパを追加"
```

---

## Task 4: `llm.worker.ts` の device 引数化

**Files:**
- Modify: `src/workers/llm.worker.ts`

- [ ] **Step 1: 現状の `llm.worker.ts` を確認**

```bash
cat src/workers/llm.worker.ts
```

L83 付近に `device: 'webgpu'` のハードコードがあることを確認。

- [ ] **Step 2: WorkerMessage 型と load handler を修正**

`src/workers/llm.worker.ts` を以下の通り修正:

```ts
import { pipeline, TextStreamer, env } from '@huggingface/transformers'
import type { ProgressInfo } from '@huggingface/transformers'

env.allowLocalModels = false
env.useBrowserCache = true

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type Dtype = 'q4f16' | 'q4' | 'fp16' | 'int8'
type Device = 'webgpu' | 'wasm'

type WorkerMessage =
  | { type: 'load'; modelId: string; dtype?: Dtype; device?: Device }
  | { type: 'chat'; messages: ChatMessage[] }
  | { type: 'abort' }

type WorkerResponse =
  | { type: 'progress'; text: string; progress: number }
  | { type: 'chunk'; delta: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

type Generator = Awaited<ReturnType<typeof pipeline<'text-generation'>>>

let generator: Generator | null = null
let abortRequested = false

function shortFile(path: string) {
  const segs = path.split('/')
  return segs[segs.length - 1] || path
}

function handleProgress(info: ProgressInfo) {
  if (info.status === 'progress_total') {
    const mb = (n: number) => (n / (1024 * 1024)).toFixed(1)
    self.postMessage({
      type: 'progress',
      text: `${mb(info.loaded)} / ${mb(info.total)} MB`,
      progress: Math.min(1, info.loaded / Math.max(1, info.total)),
    } satisfies WorkerResponse)
    return
  }
  if (info.status === 'progress') {
    self.postMessage({
      type: 'progress',
      text: shortFile(info.file),
      progress: (info.progress ?? 0) / 100,
    } satisfies WorkerResponse)
    return
  }
  if (info.status === 'download' || info.status === 'initiate') {
    self.postMessage({
      type: 'progress',
      text: `${shortFile(info.file)} を取得中`,
      progress: 0,
    } satisfies WorkerResponse)
    return
  }
  if (info.status === 'ready') {
    self.postMessage({
      type: 'progress',
      text: 'モデル準備完了',
      progress: 1,
    } satisfies WorkerResponse)
  }
}

class AbortError extends Error {
  constructor() {
    super('aborted')
    this.name = 'AbortError'
  }
}

self.addEventListener('message', async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data

  if (msg.type === 'load') {
    try {
      const device: Device = msg.device ?? 'webgpu'
      const dtype: Dtype = msg.dtype ?? (device === 'webgpu' ? 'q4f16' : 'q4')
      generator = await pipeline('text-generation', msg.modelId, {
        device,
        dtype,
        progress_callback: handleProgress,
      })
      self.postMessage({ type: 'done' } satisfies WorkerResponse)
    } catch (err) {
      self.postMessage({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      } satisfies WorkerResponse)
    }
    return
  }

  if (msg.type === 'chat') {
    if (!generator) {
      self.postMessage({ type: 'error', message: 'Model not loaded' } satisfies WorkerResponse)
      return
    }
    try {
      abortRequested = false
      const streamer = new TextStreamer(generator.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (text: string) => {
          if (abortRequested) throw new AbortError()
          if (text) self.postMessage({ type: 'chunk', delta: text } satisfies WorkerResponse)
        },
      })

      await generator(msg.messages, {
        max_new_tokens: 2048,
        temperature: 0.7,
        do_sample: true,
        streamer,
      })

      self.postMessage({ type: 'done' } satisfies WorkerResponse)
    } catch (err) {
      if (err instanceof AbortError) {
        self.postMessage({ type: 'done' } satisfies WorkerResponse)
      } else {
        self.postMessage({
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        } satisfies WorkerResponse)
      }
    }
    return
  }

  if (msg.type === 'abort') {
    abortRequested = true
  }
})
```

- [ ] **Step 3: 型チェック**

```bash
npx tsc -b --noEmit
```

期待: エラーなし。

- [ ] **Step 4: コミット**

```bash
git add src/workers/llm.worker.ts
git commit -m "feat: llm.worker.ts に device 引数を追加（WebGPU/WASM 切替対応）"
```

---

## Task 5: トーストシステムの実装

**Files:**
- Create: `src/components/Toast.tsx`

- [ ] **Step 1: `src/components/Toast.tsx` を作成**

```tsx
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
```

- [ ] **Step 2: 型チェック**

```bash
npx tsc -b --noEmit
```

期待: エラーなし。

- [ ] **Step 3: コミット**

```bash
git add src/components/Toast.tsx
git commit -m "feat: トースト通知コンポーネントを追加"
```

---

## Task 6: `useLlmModel` フックの作成

**Files:**
- Create: `src/hooks/useLlmModel.ts`

- [ ] **Step 1: `src/hooks` ディレクトリを作成**

```bash
mkdir -p src/hooks
```

- [ ] **Step 2: `src/hooks/useLlmModel.ts` を作成**

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { detectHardware, type HardwareInfo } from '../lib/hardware'
import { selectDevice, selectDtype, type Device, type Dtype } from '../lib/llmDevice'
import { storage } from '../lib/storage'

export type ModelState =
  | { kind: 'idle' }
  | { kind: 'loading'; modelId: string; modelName: string; progress: number; progressText: string }
  | { kind: 'ready'; modelId: string; modelName: string; device: Device }
  | { kind: 'error'; modelId: string; message: string }

type LoadOptions = {
  modelId: string
  modelName?: string
  dtype?: Dtype
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export type UseLlmModel = {
  state: ModelState
  hardware: HardwareInfo | null
  loadModel: (opts: LoadOptions) => void
  unloadModel: () => void
  cancelLoad: () => void
  sendChat: (
    messages: ChatMessage[],
    onChunk: (delta: string) => void,
    onDone: () => void,
    onError: (msg: string) => void,
  ) => void
  abortChat: () => void
}

function cleanModelName(modelId: string): string {
  const fallback = modelId.split('/').pop() || modelId
  return fallback
    .replace(/-?ONNX$/i, '')
    .replace(/-?Instruct(-\d+)?$/i, '')
    .replace(/-it$/i, '')
}

export function useLlmModel(onWebGpuMissing?: () => void): UseLlmModel {
  const [state, setState] = useState<ModelState>({ kind: 'idle' })
  const [hardware, setHardware] = useState<HardwareInfo | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const onWebGpuMissingFiredRef = useRef(false)

  // Detect hardware once on mount
  useEffect(() => {
    let cancelled = false
    detectHardware().then((hw) => {
      if (cancelled) return
      setHardware(hw)
      if (!hw.hasWebGPU && !onWebGpuMissingFiredRef.current) {
        onWebGpuMissingFiredRef.current = true
        onWebGpuMissing?.()
      }
    })
    return () => {
      cancelled = true
    }
  }, [onWebGpuMissing])

  // Auto-restore last model on hardware ready
  useEffect(() => {
    if (!hardware) return
    if (!storage.autoLoadModel.get()) return
    const lastId = storage.lastModel.get()
    if (!lastId) return
    if (state.kind !== 'idle') return
    loadModelInternal({ modelId: lastId }, hardware)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hardware])

  const loadModelInternal = useCallback((opts: LoadOptions, hw: HardwareInfo) => {
    // Terminate previous worker if any
    workerRef.current?.terminate()
    workerRef.current = null

    const device = selectDevice(hw)
    const dtype = selectDtype(device, opts.dtype)
    const modelName = opts.modelName ?? cleanModelName(opts.modelId)

    setState({
      kind: 'loading',
      modelId: opts.modelId,
      modelName,
      progress: 0,
      progressText: '初期化中',
    })

    const worker = new Worker(
      new URL('../workers/llm.worker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current = worker

    worker.onmessage = (e) => {
      const msg = e.data
      if (msg.type === 'progress') {
        setState((prev) =>
          prev.kind === 'loading'
            ? { ...prev, progress: msg.progress, progressText: msg.text }
            : prev,
        )
      } else if (msg.type === 'done') {
        setState({ kind: 'ready', modelId: opts.modelId, modelName, device })
        storage.lastModel.set(opts.modelId)
      } else if (msg.type === 'error') {
        setState({ kind: 'error', modelId: opts.modelId, message: msg.message })
      }
    }

    worker.postMessage({
      type: 'load',
      modelId: opts.modelId,
      device,
      dtype,
    })
  }, [])

  const loadModel = useCallback(
    (opts: LoadOptions) => {
      if (!hardware) return
      loadModelInternal(opts, hardware)
    },
    [hardware, loadModelInternal],
  )

  const unloadModel = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
    setState({ kind: 'idle' })
    storage.lastModel.clear()
  }, [])

  const cancelLoad = useCallback(() => {
    if (state.kind !== 'loading') return
    workerRef.current?.terminate()
    workerRef.current = null
    setState({ kind: 'idle' })
  }, [state.kind])

  const sendChat = useCallback(
    (
      messages: ChatMessage[],
      onChunk: (delta: string) => void,
      onDone: () => void,
      onError: (msg: string) => void,
    ) => {
      const worker = workerRef.current
      if (!worker || state.kind !== 'ready') {
        onError('Model not ready')
        return
      }
      worker.onmessage = (e) => {
        const msg = e.data
        if (msg.type === 'chunk') onChunk(msg.delta)
        else if (msg.type === 'done') onDone()
        else if (msg.type === 'error') onError(msg.message)
      }
      worker.postMessage({ type: 'chat', messages })
    },
    [state.kind],
  )

  const abortChat = useCallback(() => {
    workerRef.current?.postMessage({ type: 'abort' })
  }, [])

  return { state, hardware, loadModel, unloadModel, cancelLoad, sendChat, abortChat }
}
```

- [ ] **Step 3: 型チェック**

```bash
npx tsc -b --noEmit
```

期待: エラーなし。

- [ ] **Step 4: コミット**

```bash
git add src/hooks/useLlmModel.ts
git commit -m "feat: useLlmModel フックで LLM ライフサイクルを抽出"
```

---

## Task 7: `ModelSelector` の `isModal` 対応

**Files:**
- Modify: `src/components/ModelSelector.tsx`

現状の `ModelSelector.tsx` は Props 型 + 関数コンポーネント `ModelSelector(...)` で構成されている（[現コード](../../../src/components/ModelSelector.tsx) 参照）。フルスクリーンレイアウトを `isModal` で切替可能にする。

- [ ] **Step 1: Props 型を更新**

`src/components/ModelSelector.tsx` 11 行目付近の `interface Props` を以下に書き換え:

```tsx
interface Props {
  onSelect: (modelId: string, displayName: string) => void
  isLoading: boolean
  loadProgress: number
  loadText: string
  isModal?: boolean
  onCancel?: () => void
}
```

- [ ] **Step 2: 関数シグネチャを更新**

36 行目付近の関数シグネチャを以下に書き換え:

```tsx
export function ModelSelector({
  onSelect,
  isLoading,
  loadProgress,
  loadText,
  isModal = false,
  onCancel,
}: Props) {
```

- [ ] **Step 3: 外側のレイアウト分岐を追加**

59〜63 行目（外側 `<div>` の class とロゴ表示開始位置）を以下に書き換え:

```tsx
  const root = isModal
    ? { className: 'animate-screen-in flex flex-col w-full', style: { background: 'var(--surface)' } }
    : { className: 'animate-screen-in flex flex-col items-center justify-center min-h-screen w-full', style: { background: 'var(--bg)' } }

  return (
    <div className={root.className} style={root.style}>
      {/* Logo (full-screen mode only) */}
      {!isModal && (
        <div className="mb-12 text-center">
          <div className="flex items-center gap-4 mb-3 justify-center">
            <div className="w-10 h-10 grid grid-cols-2 gap-1">
              {[...Array(4)].map((_, i) => {
                const lit = i === 1 || i === 2
                return (
                  <div
                    key={i}
                    className="rounded"
                    style={{
                      background: lit ? 'var(--amber)' : 'var(--border2)',
                      boxShadow: lit ? '0 0 8px var(--amber-glow)' : 'none',
                    }}
                  />
                )
              })}
            </div>
            <span
              className="text-3xl font-medium"
              style={{ color: 'var(--text)', letterSpacing: '0.2em' }}
            >
              BROWSER<span style={{ color: 'var(--amber-strong)' }}>IDE</span>
            </span>
          </div>
          <p className="text-base" style={{ color: 'var(--text-muted)' }}>
            ブラウザだけで動く、プライベートなAI搭載IDE
          </p>
        </div>
      )}
```

- [ ] **Step 4: パネル本体のスタイル調整 + 「キャンセル」ボタン追加**

94〜124 行目付近の `{/* Panel */}` 区画を以下に書き換え（isModal のときは `bezel` の枠を外し、ヘッダーに「キャンセル」ボタンを追加）:

```tsx
      {/* Panel */}
      <div
        className={isModal ? 'w-full flex flex-col flex-1 min-h-0' : 'w-full bezel'}
        style={{
          maxWidth: isModal ? undefined : '560px',
          background: 'var(--surface)',
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}
        >
          <span className="text-base" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
            AIモデルを選択
          </span>
          <div className="flex items-center gap-3">
            {hw && (
              <span
                className="text-sm tabular flex items-center gap-2"
                style={{ color: hw.hasWebGPU ? 'var(--green)' : 'var(--amber-mute)' }}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{
                    background: hw.hasWebGPU ? 'var(--green)' : 'var(--amber)',
                    boxShadow: hw.hasWebGPU ? '0 0 6px var(--green)' : '0 0 6px var(--amber-glow)',
                  }}
                />
                {hw.hasWebGPU ? 'GPU 使用可能' : 'CPU 動作'}
              </span>
            )}
            {isModal && onCancel && (
              <button
                onClick={onCancel}
                className="press text-xs px-2 py-1"
                style={{
                  color: 'var(--text-dim)',
                  border: '1px solid var(--border2)',
                  background: 'transparent',
                }}
              >
                キャンセル
              </button>
            )}
          </div>
        </div>
```

- [ ] **Step 5: モデル一覧の高さ調整**

126 行目付近の `maxHeight: '52vh'` を `isModal` 時は伸ばす:

```tsx
        <div className="p-2 overflow-y-auto" style={{ maxHeight: isModal ? '60vh' : '52vh' }}>
```

- [ ] **Step 6: 末尾の「初回のみ X のダウンロード」表示を modal で隠す**

300〜304 行目付近の説明テキストを `!isModal` で囲む:

```tsx
      {!isModal && (
        <div className="mt-6 text-xs tabular" style={{ color: 'var(--text-dim)' }}>
          {selectedIndex >= 0 && models[selectedIndex] && (
            <>初回のみ {models[selectedIndex].sizeLabel} のダウンロードが発生します</>
          )}
        </div>
      )}
```

- [ ] **Step 7: 型チェック**

```bash
npx tsc -b --noEmit
```

期待: エラーなし。

- [ ] **Step 8: コミット**

```bash
git add src/components/ModelSelector.tsx
git commit -m "feat: ModelSelector を isModal 対応にしてモーダル利用を可能化"
```

---

## Task 8: `ModelPicker` モーダルラッパの作成

**Files:**
- Create: `src/components/ModelPicker.tsx`

- [ ] **Step 1: `src/components/ModelPicker.tsx` を作成**

```tsx
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
```

- [ ] **Step 2: 型チェック**

```bash
npx tsc -b --noEmit
```

期待: エラーなし。

- [ ] **Step 3: コミット**

```bash
git add src/components/ModelPicker.tsx
git commit -m "feat: ModelPicker モーダルラッパを追加"
```

---

## Task 9: `ChatPanel` の 4 状態 UI 化

**Files:**
- Modify: `src/components/ChatPanel.tsx`

- [ ] **Step 1: 現状の ChatPanel の Props を確認**

```bash
head -50 src/components/ChatPanel.tsx
```

現状は `messages`, `isGenerating`, `onSend`, `onAbort`, `onApplyCode`, `inputRef` を受け取る前提。

- [ ] **Step 2: ChatPanel の Props に `modelState` を追加して 4 状態 UI を実装**

`src/components/ChatPanel.tsx` の Props 型を修正:

```tsx
import type { ModelState } from '../hooks/useLlmModel'

export type Message = { role: 'user' | 'assistant'; content: string }

interface Props {
  messages: Message[]
  isGenerating: boolean
  onSend: (text: string) => void
  onAbort: () => void
  onApplyCode: (code: string) => void
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  modelState: ModelState
  onPickModel: () => void
  onSwitchModel: () => void
  onUnloadModel: () => void
  onCancelLoad: () => void
  onRetryLoad: () => void
}
```

コンポーネント本体は `modelState.kind` で大きく分岐する構成:

```tsx
export function ChatPanel(props: Props) {
  const { modelState } = props
  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface)' }}>
      <Header modelState={modelState} onSwitchModel={props.onSwitchModel} onUnloadModel={props.onUnloadModel} />
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {modelState.kind === 'idle' && <IdleView onPickModel={props.onPickModel} />}
        {modelState.kind === 'loading' && (
          <LoadingView state={modelState} onCancel={props.onCancelLoad} />
        )}
        {modelState.kind === 'error' && (
          <ErrorView state={modelState} onRetry={props.onRetryLoad} onPickModel={props.onPickModel} />
        )}
        {modelState.kind === 'ready' && (
          <ReadyView
            messages={props.messages}
            isGenerating={props.isGenerating}
            onSend={props.onSend}
            onAbort={props.onAbort}
            onApplyCode={props.onApplyCode}
            inputRef={props.inputRef}
          />
        )}
      </div>
    </div>
  )
}
```

各 View をファイル内で定義（簡潔に）:

```tsx
function Header({
  modelState,
  onSwitchModel,
  onUnloadModel,
}: {
  modelState: ModelState
  onSwitchModel: () => void
  onUnloadModel: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const label =
    modelState.kind === 'idle' ? 'AI 未選択' :
    modelState.kind === 'loading' ? `${modelState.modelName} を読込中` :
    modelState.kind === 'error' ? `エラー (${modelState.message})` :
    modelState.modelName

  return (
    <div
      className="flex items-center justify-between px-4 shrink-0"
      style={{ height: '34px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}
    >
      <span className="text-sm" style={{ color: 'var(--text-dim)', letterSpacing: '0.06em' }}>
        💬 Chat
      </span>
      <span className="text-xs truncate tabular flex items-center gap-2" style={{ color: 'var(--text-dim)', maxWidth: '60%' }}>
        {label}
        {modelState.kind === 'ready' && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
            >
              ⋯
            </button>
            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 24,
                  right: 0,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  minWidth: 160,
                  zIndex: 10,
                }}
              >
                <button
                  onClick={() => { setMenuOpen(false); onSwitchModel() }}
                  style={menuItemStyle}
                >
                  モデル切替
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onUnloadModel() }}
                  style={menuItemStyle}
                >
                  モデルをアンロード
                </button>
              </div>
            )}
          </div>
        )}
      </span>
    </div>
  )
}

const menuItemStyle: React.CSSProperties = {
  width: '100%',
  textAlign: 'left',
  padding: '8px 12px',
  background: 'transparent',
  border: 'none',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: 13,
}

function IdleView({ onPickModel }: { onPickModel: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center flex-col gap-4 p-6">
      <p className="text-sm text-center" style={{ color: 'var(--text-dim)' }}>
        AI を使うにはモデルを選択してください
      </p>
      <button
        onClick={onPickModel}
        style={{
          padding: '8px 20px',
          background: 'var(--amber)',
          color: 'var(--bg)',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        モデルを選択
      </button>
    </div>
  )
}

function LoadingView({
  state,
  onCancel,
}: {
  state: Extract<ModelState, { kind: 'loading' }>
  onCancel: () => void
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
      <p className="text-sm" style={{ color: 'var(--text)' }}>
        {state.modelName}
      </p>
      <p className="text-xs tabular" style={{ color: 'var(--text-dim)' }}>
        {state.progressText}
      </p>
      <div
        style={{
          width: '80%',
          height: 4,
          background: 'var(--border)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.round(state.progress * 100)}%`,
            height: '100%',
            background: 'var(--amber)',
            transition: 'width 200ms ease',
          }}
        />
      </div>
      <p className="text-xs text-center" style={{ color: 'var(--text-dim)' }}>
        ※ ダウンロード中もエディタは使えます
      </p>
      <button
        onClick={onCancel}
        style={{
          padding: '6px 16px',
          background: 'transparent',
          color: 'var(--text-dim)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 12,
        }}
      >
        キャンセル
      </button>
    </div>
  )
}

function ErrorView({
  state,
  onRetry,
  onPickModel,
}: {
  state: Extract<ModelState, { kind: 'error' }>
  onRetry: () => void
  onPickModel: () => void
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
      <p className="text-sm" style={{ color: 'var(--red)' }}>
        モデル読込失敗
      </p>
      <p className="text-xs text-center" style={{ color: 'var(--text-dim)', maxWidth: 280 }}>
        {state.message}
      </p>
      <div className="flex gap-2">
        <button
          onClick={onRetry}
          style={{
            padding: '6px 16px',
            background: 'var(--amber)',
            color: 'var(--bg)',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          再試行
        </button>
        <button
          onClick={onPickModel}
          style={{
            padding: '6px 16px',
            background: 'transparent',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          別モデルを選ぶ
        </button>
      </div>
    </div>
  )
}

function ReadyView({
  messages,
  isGenerating,
  onSend,
  onAbort,
  onApplyCode,
  inputRef,
}: {
  messages: Message[]
  isGenerating: boolean
  onSend: (text: string) => void
  onAbort: () => void
  onApplyCode: (code: string) => void
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
}) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const localInputRef = useRef<HTMLTextAreaElement>(null)
  const textareaRef = inputRef ?? localInputRef

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight
      stickToBottomRef.current = distance < 80
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (!stickToBottomRef.current) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  const handleSubmit = (text?: string) => {
    const value = (text ?? input).trim()
    if (!value || isGenerating) return
    onSend(value)
    setInput('')
    stickToBottomRef.current = true
  }

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
        {messages.length === 0 && (
          <div className="flex flex-col gap-3 mt-1">
            <span className="text-sm" style={{ color: 'var(--text-dim)' }}>
              &gt; どんなアプリを作りますか？
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {SAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => handleSubmit(p)}
                  className="press text-xs px-2.5 py-1"
                  style={{
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border2)',
                    background: 'transparent',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            <span className="text-xs mt-2" style={{ color: 'var(--text-dim)' }}>
              ⌘K で入力にフォーカス
            </span>
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} onApplyCode={onApplyCode} />
        ))}
      </div>

      <div className="shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-start gap-0">
          <span className="px-4 py-3 text-sm select-none shrink-0" style={{ color: 'var(--amber)' }}>
            &gt;
          </span>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            placeholder="メッセージを入力..."
            rows={2}
            className="flex-1 py-3 pr-2 text-sm resize-none outline-none"
            style={{
              background: 'transparent',
              color: 'var(--text)',
              caretColor: 'var(--amber)',
              fontFamily: 'var(--font)',
            }}
          />
          <button
            onClick={() => (isGenerating ? onAbort() : handleSubmit())}
            disabled={!isGenerating && !input.trim()}
            className="press p-3 shrink-0 disabled:opacity-20"
            style={{ color: isGenerating ? 'var(--red)' : 'var(--amber)', background: 'transparent' }}
          >
            {isGenerating ? <Square size={14} /> : <CornerDownLeft size={14} />}
          </button>
        </div>
      </div>
    </>
  )
}
```

`ReadyView` は現状の `ChatPanel` 関数の `return` 部分の `<div className="flex-1 overflow-y-auto ...">` 以降と入力欄ブロックを 1:1 で持ってきたもの。`MessageBubble` と `SAMPLE_PROMPTS` と `extractCodeBlock` はファイルトップレベルにそのまま残す（移動不要）。

ファイル冒頭の `import` に以下を追加:

```tsx
import type { ModelState } from '../hooks/useLlmModel'
```

既存の `Header` 名のローカル関数は無いので、本プランの `HeaderBar` をそのまま追加で OK（衝突なし）。

- [ ] **Step 3: 型チェック**

```bash
npx tsc -b --noEmit
```

期待: エラーなし。

- [ ] **Step 4: コミット**

```bash
git add src/components/ChatPanel.tsx
git commit -m "feat: ChatPanel を 4 状態（idle/loading/ready/error）UI に再構成"
```

---

## Task 10: `Splitter` の縦分割動作確認（修正不要）

**Files:** （変更なし、既存実装の確認のみ）

[現コード](../../../src/components/Splitter.tsx) を確認したところ、`Splitter.tsx` は既に `orientation: 'vertical' | 'horizontal'` 両対応している。`isV = orientation === 'vertical'` の分岐で `flex-row` / `flex-col` を切替、`width` / `height` も適切に設定済み。

Task 13 で 4 ペインレイアウトを組む際に縦 Splitter（`orientation="horizontal"`）を使うが、追加修正は不要。Task 10 は **このタスク自体をスキップ**して Task 11 に進む。

ただし以下の点だけは Task 13 で確認する:

- `Splitter` の `children` は厳密に 2 要素配列を要求する（`children: [React.ReactNode, React.ReactNode]`）。3 ペイン以上のレイアウトでは Splitter を**ネスト**して構成する
- `defaultPercent` は左/上ペインの占有率
- `min`/`max` の単位はパーセント（既定 20-80）

このタスクは「確認済み、修正なし」として完了扱い。コミットは作らない。

---

## Task 11: `FileTreePlaceholder` コンポーネントの作成

**Files:**
- Create: `src/components/FileTreePlaceholder.tsx`

- [ ] **Step 1: `src/components/FileTreePlaceholder.tsx` を作成**

```tsx
export function FileTreePlaceholder() {
  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface2)', borderRight: '1px solid var(--border)' }}>
      <div
        className="px-4 flex items-center"
        style={{ height: '34px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}
      >
        <span className="text-sm" style={{ color: 'var(--text-dim)', letterSpacing: '0.06em' }}>
          📁 EXPLORER
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-xs text-center" style={{ color: 'var(--text-dim)' }}>
          ファイルツリーは Week 2 で実装予定
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 型チェック**

```bash
npx tsc -b --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add src/components/FileTreePlaceholder.tsx
git commit -m "feat: FileTreePlaceholder（左ペインのプレースホルダ）を追加"
```

---

## Task 12: `Console` パネル skeleton の作成

**Files:**
- Create: `src/components/Console.tsx`

- [ ] **Step 1: `src/components/Console.tsx` を作成**

```tsx
import { useState } from 'react'

export function Console() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface2)', borderTop: '1px solid var(--border)' }}>
      <div
        className="px-4 flex items-center justify-between shrink-0"
        style={{ height: '28px', borderBottom: '1px solid var(--border)' }}
      >
        <button
          onClick={() => setCollapsed((v) => !v)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ display: 'inline-block', transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 150ms' }}>▼</span>
          <span style={{ letterSpacing: '0.06em' }}>CONSOLE</span>
        </button>
      </div>
      {!collapsed && (
        <div className="flex-1 overflow-auto p-3 tabular text-xs" style={{ color: 'var(--text-dim)' }}>
          <p style={{ opacity: 0.5 }}>
            （プレビュー実行時のログがここに表示されます。Week 3 で連携実装予定。）
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 型チェック**

```bash
npx tsc -b --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add src/components/Console.tsx
git commit -m "feat: Console パネル skeleton を追加（折りたたみ可、ログ連携は Week 3）"
```

---

## Task 13: `App.tsx` の全面リファクタ（4 ペイン化 + ゲート撤去）

**Files:**
- Modify: `src/App.tsx`

これは大きな変更なので、段階的に行う。

- [ ] **Step 1: 必要な import を追加**

`src/App.tsx` の先頭の import 群を以下に置換:

```tsx
import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Play } from 'lucide-react'
import { Editor } from './components/Editor'
import { Preview, type PreviewStatus } from './components/Preview'
import { ChatPanel, type Message } from './components/ChatPanel'
import { ModelPicker } from './components/ModelPicker'
import { Splitter } from './components/Splitter'
import { Console } from './components/Console'
import { FileTreePlaceholder } from './components/FileTreePlaceholder'
import { ToastProvider, useToast } from './components/Toast'
import { useLlmModel } from './hooks/useLlmModel'
import { storage } from './lib/storage'
import './index.css'
```

- [ ] **Step 2: AppState 型と関連ステートを撤去**

`type AppState = 'model-select' | 'ready'` の型定義と、`appState` ステートを削除する。

- [ ] **Step 3: `App` を `AppInner` に分離して `ToastProvider` でラップ**

ファイル末尾の構造を以下にする:

```tsx
export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  )
}

function AppInner() {
  // 以下、現状の App の中身をここに移す（ただし AppState ゲートは削除）
}
```

- [ ] **Step 4: `AppInner` の中身を 4 ペインレイアウトに書き換える**

`AppInner` の本体を以下の構造で書き直す:

```tsx
function AppInner() {
  const toast = useToast()
  const llm = useLlmModel(() => {
    toast.show('warn', 'WebGPU 非対応環境です。CPU 動作になり推論が大幅に遅くなります（〜2 tok/s）')
  })

  const [code, setCode] = useState(DEFAULT_CODE)
  const [previewCode, setPreviewCode] = useState(DEFAULT_CODE)
  const [messages, setMessages] = useState<Message[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>({ kind: 'idle' })
  const [editorFlashKey, setEditorFlashKey] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)

  const chatInputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-preview (1.5s debounce)
  useEffect(() => {
    const timer = setTimeout(() => setPreviewCode(code), 1500)
    return () => clearTimeout(timer)
  }, [code])

  // Global shortcuts: ⌘Enter run, ⌘K focus chat
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'Enter') {
        e.preventDefault()
        setPreviewCode(code)
      } else if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        chatInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [code])

  const sendMessage = useCallback((text: string) => {
    const userMsg: Message = { role: 'user', content: text }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setIsGenerating(true)
    setMessages([...updatedMessages, { role: 'assistant', content: '' }])

    llm.sendChat(
      [
        {
          role: 'system',
          content: 'You are a coding assistant. Always include React as a global (it is available as window.React). Return code in ```tsx code blocks.',
        },
        ...updatedMessages.map((m) => ({ role: m.role, content: m.content })),
      ],
      (delta) => {
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = {
            ...next[next.length - 1],
            content: next[next.length - 1].content + delta,
          }
          return next
        })
      },
      () => setIsGenerating(false),
      (msg) => {
        setIsGenerating(false)
        toast.show('error', `送信エラー: ${msg}`)
      },
    )
  }, [messages, llm, toast])

  const abortGeneration = useCallback(() => {
    llm.abortChat()
    setIsGenerating(false)
  }, [llm])

  const applyCode = useCallback((newCode: string) => {
    setCode(newCode)
    setPreviewCode(newCode)
    setEditorFlashKey((n) => n + 1)
  }, [])

  const handleCursorChange = useCallback((line: number, col: number) => {
    setCursor({ line, col })
  }, [])

  const handlePickModel = useCallback((modelId: string, displayName?: string) => {
    setPickerOpen(false)
    llm.loadModel({ modelId, modelName: displayName })
  }, [llm])

  const lastLoadOptsRef = useRef<{ modelId: string; modelName?: string } | null>(null)
  useEffect(() => {
    if (llm.state.kind === 'loading' || llm.state.kind === 'ready') {
      lastLoadOptsRef.current = {
        modelId: llm.state.modelId,
        modelName: 'modelName' in llm.state ? llm.state.modelName : undefined,
      }
    }
  }, [llm.state])

  const retryLoad = useCallback(() => {
    const opts = lastLoadOptsRef.current
    if (opts) llm.loadModel(opts)
  }, [llm])

  const statusInfo = useMemo(() => {
    switch (previewStatus.kind) {
      case 'compiling': return { dot: 'var(--amber)', label: 'compile', detail: 'コンパイル中' }
      case 'ok': return { dot: 'var(--green)', label: 'ok', detail: formatTime(previewStatus.ranAt) }
      case 'error': return { dot: 'var(--red)', label: 'error', detail: previewStatus.message }
      default: return { dot: 'var(--text-dim)', label: 'idle', detail: '待機中' }
    }
  }, [previewStatus])

  const lineCount = useMemo(() => code.split('\n').length, [code])
  const charCount = code.length

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)' }}>
      <Header llmState={llm.state} statusInfo={statusInfo} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: file tree placeholder */}
        <Splitter storageKey="bide.split.tree" defaultPercent={18} min={10} max={40} orientation="vertical">
          <FileTreePlaceholder />

          {/* Center + Right */}
          <Splitter storageKey="bide.split.chat" defaultPercent={74} min={55} max={82} orientation="vertical">
            {/* Center: editor + console (vertical split) */}
            <Splitter storageKey="bide.split.console" defaultPercent={78} min={40} max={100} orientation="horizontal">
              {/* Top: editor */}
              <div className="flex flex-col min-w-0 w-full">
                <div
                  className="flex items-center justify-between px-4 shrink-0"
                  style={{ height: '34px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
                >
                  <span className="text-sm tabular" style={{ color: 'var(--text-dim)' }}>main.tsx</span>
                  <button
                    onClick={() => setPreviewCode(code)}
                    className="press flex items-center gap-1.5 px-2.5 text-xs font-medium"
                    style={{ height: '22px', color: 'var(--bg)', background: 'var(--green)' }}
                    title="⌘Enter で即時実行"
                  >
                    <Play size={10} />
                    実行
                  </button>
                </div>
                <div
                  key={editorFlashKey}
                  className={`flex-1 overflow-hidden relative ${editorFlashKey > 0 ? 'animate-flash' : ''}`}
                >
                  <Editor value={code} onChange={setCode} onCursorChange={handleCursorChange} />
                </div>
                <div
                  className="flex items-center gap-4 px-4 shrink-0 tabular"
                  style={{ height: '22px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}
                >
                  <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                    {cursor.line.toString().padStart(2, '0')}:{cursor.col.toString().padStart(2, '0')}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                    {lineCount}行 · {charCount}字
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-dim)' }}>TSX</span>
                  <span className="text-xs ml-auto" style={{ color: 'var(--text-dim)' }}>
                    ⌘Enter 実行 · ⌘K チャット
                  </span>
                </div>

                {/* Preview embedded in main editor area for now */}
                <div className="flex-1" style={{ borderTop: '1px solid var(--border)' }}>
                  {previewCode ? (
                    <Preview code={previewCode} onStatus={setPreviewStatus} />
                  ) : (
                    <div className="h-full flex items-center justify-center" style={{ background: 'var(--surface)' }}>
                      <span className="text-sm" style={{ color: 'var(--text-dim)' }}>
                        「<span style={{ color: 'var(--green)' }}>実行</span>」またはコード編集で表示
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom: console */}
              <Console />
            </Splitter>

            {/* Right: chat */}
            <ChatPanel
              messages={messages}
              isGenerating={isGenerating}
              onSend={sendMessage}
              onAbort={abortGeneration}
              onApplyCode={applyCode}
              inputRef={chatInputRef}
              modelState={llm.state}
              onPickModel={() => setPickerOpen(true)}
              onSwitchModel={() => setPickerOpen(true)}
              onUnloadModel={llm.unloadModel}
              onCancelLoad={llm.cancelLoad}
              onRetryLoad={retryLoad}
            />
          </Splitter>
        </Splitter>
      </div>

      <ModelPicker
        open={pickerOpen}
        onSelect={handlePickModel}
        onClose={() => setPickerOpen(false)}
        isLoading={llm.state.kind === 'loading'}
        loadProgress={llm.state.kind === 'loading' ? llm.state.progress : 0}
        loadText={llm.state.kind === 'loading' ? llm.state.progressText : ''}
      />
    </div>
  )
}
```

加えて Header コンポーネントを同ファイル内に切り出す:

```tsx
function Header({
  llmState,
  statusInfo,
}: {
  llmState: ModelState
  statusInfo: { dot: string; label: string; detail: string }
}) {
  const modelLabel = llmState.kind === 'ready' ? llmState.modelName :
                     llmState.kind === 'loading' ? `${llmState.modelName} 読込中` :
                     llmState.kind === 'error' ? 'エラー' :
                     '未選択'
  return (
    <header
      className="flex items-center gap-3 px-4 shrink-0"
      style={{ height: '36px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}
    >
      <div className="flex items-center gap-2">
        <div className="w-3.5 h-3.5 grid grid-cols-2 gap-px">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-sm"
              style={{
                background: i === 1 || i === 2 ? 'var(--amber)' : 'var(--border2)',
                boxShadow: i === 1 || i === 2 ? '0 0 4px var(--amber-glow)' : 'none',
              }}
            />
          ))}
        </div>
        <span className="text-sm font-medium" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
          BROWSER<span style={{ color: 'var(--amber-strong)' }}>IDE</span>
        </span>
      </div>
      <span style={{ color: 'var(--text-dim)' }}>/</span>
      <span className="text-xs truncate tabular" style={{ color: 'var(--text-dim)', maxWidth: '260px' }}>
        {modelLabel}
      </span>
      <span className="ml-auto flex items-center gap-2 text-xs tabular" style={{ color: 'var(--text-dim)' }}>
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{
            background: statusInfo.dot,
            boxShadow: `0 0 6px ${statusInfo.dot}`,
            transition: 'background 200ms var(--ease)',
          }}
        />
        <span style={{ letterSpacing: '0.08em' }}>{statusInfo.label}</span>
      </span>
    </header>
  )
}
```

`ModelState` 型は冒頭の import で `import type { ModelState } from './hooks/useLlmModel'` として追加する。

`DEFAULT_CODE` と `formatTime` 関数は現状のものをそのまま流用。

- [ ] **Step 5: 型チェックとビルド**

```bash
npx tsc -b --noEmit
```

期待: エラーなし。

```bash
npm run build
```

期待: ビルド成功（警告は OK、エラーは NG）。

- [ ] **Step 6: コミット**

```bash
git add src/App.tsx
git commit -m "refactor: App.tsx を 4 ペインレイアウト + LLM ライフサイクル抽出に再構成

- AppState ゲート画面を撤去、起動直後からエディタ完全動作
- ChatPanel に modelState を渡して 4 状態 UI に対応
- ModelPicker モーダルでモデル切替可能
- 4 ペインレイアウト基盤（FileTreePlaceholder + Console を配置）
- ToastProvider で全画面トースト対応"
```

---

## Task 14: 旧 localStorage キーのマイグレーション

**Files:**
- Modify: `src/App.tsx`（一度限りのマイグレーションコード追加）

- [ ] **Step 1: 旧キーから新キーへの移行コードを追加**

`AppInner` の冒頭付近（`useToast` の直後など）に以下を追加:

```tsx
// Migrate old localStorage keys (one-time)
useEffect(() => {
  const migrated = localStorage.getItem('bide.migrated.v1')
  if (migrated) return
  const oldH = localStorage.getItem('bide.split.h')
  if (oldH && !localStorage.getItem('bide.split.tree')) {
    // 旧キーは捨てる前提で（spec 通り）、新キーは defaultPercent から開始
    localStorage.removeItem('bide.split.h')
  }
  const oldV = localStorage.getItem('bide.split.v')
  if (oldV) localStorage.removeItem('bide.split.v')
  localStorage.setItem('bide.migrated.v1', 'true')
}, [])
```

- [ ] **Step 2: 型チェック**

```bash
npx tsc -b --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add src/App.tsx
git commit -m "chore: 旧 Splitter localStorage キーを一度限りでクリア"
```

---

## Task 15: 動作検証 — golden path 通し確認

**Files:** （変更なし、検証のみ）

- [ ] **Step 1: 全テスト実行**

```bash
npm run test:run
```

期待: Task 2 と Task 3 で書いたテスト計 9 件がパス。

- [ ] **Step 2: 型チェック**

```bash
npx tsc -b --noEmit
```

期待: エラーなし。

- [ ] **Step 3: ビルド**

```bash
npm run build
```

期待: 成功（警告のみ可、エラー NG）。

- [ ] **Step 4: dev server を起動**

```bash
npm run dev
```

ブラウザで `http://localhost:5173` を開く。以下を順に確認:

| # | 操作 | 期待される結果 |
|---|---|---|
| 1 | ページロード直後 | エディタが即時表示される（ゲート画面なし）、`main.tsx` の DEFAULT_CODE が見える |
| 2 | エディタを編集 | 1.5 秒後にプレビューが更新される（`Counter` が動く） |
| 3 | ⌘Enter | 即座にプレビュー更新 |
| 4 | チャットエリア | 「AI を使うにはモデルを選択してください」表示 + 「モデルを選択」ボタン |
| 5 | 「モデルを選択」クリック | ModelPicker モーダルが開く（ハードウェア検出済み、推奨モデルにバッジ） |
| 6 | 軽量モデル（Llama-3.2-1B 等）を選択 | モーダル閉じる、ChatPanel が loading 状態（プログレスバー） |
| 7 | ロード中にエディタ編集 | 編集できる、プレビューも動く、UI 固まらない |
| 8 | ロード完了後 | ChatPanel が ready 状態、入力欄活性化 |
| 9 | 「⋯」メニューを開く | 「モデル切替」「モデルをアンロード」が見える |
| 10 | 「モデル切替」クリック | ModelPicker が再度開く |
| 11 | キャンセル | モーダル閉じる、状態維持 |
| 12 | チャットでメッセージ送信 | 応答ストリーム表示 |
| 13 | リロード | 前回モデルが自動ロード開始（loading 状態へ） |
| 14 | 「⋯」→「モデルをアンロード」 | idle 状態に戻る |
| 15 | レイアウトの境界線をドラッグ | 左ファイルツリー幅・右チャット幅・下コンソール高さが変わる |
| 16 | リロード後 | 境界線位置が復元される |

すべて期待通りなら検証完了。

WebGPU 非対応ブラウザでテストできれば、追加で:
- WebGPU 警告トーストが表示される
- WASM フォールバックでロード進む（時間はかかる）

- [ ] **Step 5: 動作確認のスクショまたはメモを記録**

`docs/superpowers/plans/week1-verification.md` に検証メモを残す（任意）:

```bash
cat > docs/superpowers/plans/week1-verification.md <<'EOF'
# Week 1 動作検証メモ

実施日: YYYY-MM-DD
検証環境: macOS / Chrome [version]

| 項目 | 結果 |
|---|---|
| エディタ即時表示 | ✓ |
| モデルロード中もエディタ動作 | ✓ |
| 4 ペインレイアウト | ✓ |
| Splitter 復元 | ✓ |
| 自動モデル復元 | ✓ |
| WebGPU 検出 | ✓ |

## 既知の問題
（あれば記載）

## 次 Week への引き継ぎ事項
（あれば記載）
EOF
```

- [ ] **Step 6: 検証コミット**

```bash
git add docs/superpowers/plans/week1-verification.md 2>/dev/null
git commit -m "docs: Week 1 動作検証メモ" 2>/dev/null || echo "（検証メモ無し、スキップ）"
```

---

## Week 1 完了基準

すべての Task が完了したら以下を確認して Week 1 完了:

- [ ] Task 1〜15 すべて完了
- [ ] `npm run test:run` がパス（9 件）
- [ ] `npm run build` が成功
- [ ] dev server で Task 15 の golden path 通り動作
- [ ] git log で Task 単位のコミットが残っている
- [ ] spec の Phase 1 マスト項目のうち、F + B 関連項目（13 項目）すべてチェック
- [ ] ロードマップの Week 1 ステータスを「完了」に更新

ロードマップの更新コミット例:

```bash
# docs/superpowers/plans/2026-04-27-roadmap.md の進捗管理表を更新
# Week 1 のステータスを「完了」+ 完了日を記入
git add docs/superpowers/plans/2026-04-27-roadmap.md
git commit -m "docs: Week 1 完了をロードマップに反映"
```

その後 Week 2 詳細プランを `2026-04-27-week2-opfs-and-filetree.md` として作成する。

---

## 想定外時のフォールバック

| 問題 | 対応 |
|---|---|
| `@huggingface/transformers` v4 で `device: 'wasm'` が未対応だった | `device: 'cpu'` または fallback 値を試す（Task 4） |
| `Vitest` のセットアップでビルドエラー | `vite.config.ts` の `/// <reference types="vitest" />` 追加忘れがないか確認 |
| `useLlmModel` の自動ロードが無限ループ | `useEffect` の依存配列に `state.kind` を含めない（Task 6 の通り） |
| Splitter の縦分割が綺麗に動かない | `Splitter.tsx` の orientation 処理を独立にチェック（Task 10 の Step 2） |
| ChatPanel の状態切替で再レンダーが多い | `ChatPanel` を `React.memo` でラップ（最適化、必須ではない） |
| ModelSelector が isModal で見た目崩れる | 既存スタイルとの調整、`overflow-y: auto` 追加など |

---

## 実装完了レポート（2026-04-28）

ステータス: ✅ **完了**。Task 1〜15 すべて実装済み、テスト 12/12 pass、ビルド成功、dev server 動作確認済み。

### 計画通りに実装した項目（Task 1〜15）

すべて実装済み。詳細は git log の `feature/week1-llm-lifecycle` ブランチを参照。

### 計画外で追加された主要変更

実装中に判明した課題・ユーザーフィードバックで追加された変更:

#### 1. 環境セットアップの修正
- `npm install --legacy-peer-deps` 必須（vite-plugin-pwa@1.2.0 と vite@8 の peer 衝突）
- Node 22 が必須（既定シェルが Node 14、Vitest 4 / Vite 8 が未対応）
- `.nvmrc` に `22` を pin、`package.json` の `engines.node >=20` 明記
- **Vitest を v2 → v4 に変更**（spec で `^2` 指定したが Vite 8 peer 非対応のため）

#### 2. レイアウト方式の刷新（VS Code 風への昇格）

spec ではセクション 1 でレイアウト「軸」を 3 つの Splitter ネストとして定義していたが、実装中に以下の問題が判明:

- percentage Splitter ネストでは「Explorer 閉じても center が広がらない」
- Splitter ドラッグで一方が極小になり、「黒い空白」が出る

ユーザーフィードバックにより以下の VS Code 風デザインに変更:

- **Activity Bar 新設**（`src/components/ActivityBar.tsx`）: 左端 44px の固定アイコン列で Explorer/Chat/Console を toggle
- **EditorTabs 新設**（`src/components/EditorTabs.tsx`）: `main.tsx` + `🌐 Preview` の 2 タブ。Preview は ✗ で閉じれる
- **ResizableHandle 新設**（`src/components/ResizableHandle.tsx`）: Explorer/Chat は **pixel ベース幅**（240px / 380px）でドラッグリサイズ。center は flex:1 で残りを取る
- 結果として「Explorer 閉じる → center だけ広がる」（VS Code と同じ挙動）が実現

#### 3. UI バグ修正の積み重ね

実機検証で発覚した複数のバグを修正:

- **Splitter ドラッグ時の黒空白**: パネル root の `flex flex-col h-full` だけでは flex-row ラッパー内でコンテンツ幅にしかならない。`w-full min-w-0` を追加
- **Console 下の余白**: flex 子に `min-h-0` を追加（`min-height: auto` の既定を上書き）
- **Explorer placeholder の空白感**: 中央寄せの小さなテキストではなく、mock ツリー + 「Week 2 で開放予定」カードで視覚的に充填
- **localStorage 永続化キー**: 旧バージョンの破損値を強制リセットするため migration バージョンを v1 → v2 → v3 → v4 と複数回 bump

#### 4. ChatPanel の実用化

spec に書かれていなかったが、実用上必要だった改善:

- **モデル切替/アンロードドロップダウン**: portal で `document.body` に描画、document click リスナーで close
  - 当初 `mousedown` リスナーだったが portal の click より先に発火 → menu unmount → click 届かずバグ → `click` リスナーに変更
- **textarea auto-resize**: 入力に応じて 2〜10 行で自動拡張、超過時は overflow-y:auto でスクロール
- **IME 確定 Enter のスキップ**: `e.nativeEvent.isComposing` で日本語確定 Enter を「送信」と誤判定しないように
- **Esc キーの段階的アクション**: 生成中→中止 / 入力あり→クリア / 空→blur

#### 5. CodeMirror エディタの強化

spec では明示されていなかったが、IDE として最低限必要なため追加:

- `history()` extension + `historyKeymap` を明示的に登録（undo/redo）
- `defaultKeymap` で `⌘D` multi-cursor、`⌥↑/↓` 行移動、`⌘/` コメント等
- `indentWithTab` で Tab/Shift+Tab インデント

#### 6. Cross-platform キーラベル

spec にはなかったが、Mac/Windows 両対応のため追加:

- `src/lib/platform.ts` の `key('Mod', 'X')` ヘルパー
- Mac: `⌘B` / Windows・Linux: `Ctrl+B`
- Activity Bar・status bar・閉じるツールチップ等すべての表記に適用

### Week 1 で生じた spec への反映余地（Week 2 以降の参考）

- spec セクション 1 のレイアウト構造記述は実装と乖離（Splitter 3 ネスト → Activity Bar + pixel ResizableHandle 構成）。Week 2 開始時に spec の図を更新するのが望ましい
- `bide.split.console` 等の localStorage キー名も実装で `bide.split.v4.console` になっている
- 「Console」の役割が当初よりも「ステータス表示専用 placeholder」寄り（実ログは Week 3）

### 数値サマリ

- コミット数: 22（feature/week1-llm-lifecycle ブランチ）
- 新規ファイル: 11（src 配下）
- 修正ファイル: 5（既存）
- テスト: 12 件 pass（`llmDevice.ts`, `storage.ts`）
- バンドルサイズ: 799 KB（gzip 257 KB）
- dev server boot: ~270ms

### Week 2 への引き継ぎ

優先度高い順:

1. **OPFS + FsAdapter / FsAdapterSync** — Phase 2 の基盤
2. **WorkspaceStore + 本物の FileTree** — placeholder を実装に置き換え
3. **TabManager の前準備**（Week 3 の素地）
4. spec のレイアウト記述を Week 1 実装に合わせて更新（任意）
