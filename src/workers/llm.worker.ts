import { pipeline, TextStreamer, env } from '@huggingface/transformers'
import type { ProgressInfo } from '@huggingface/transformers'

env.allowLocalModels = false
env.useBrowserCache = true

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type Dtype = 'q4f16' | 'q4' | 'fp16' | 'int8'

type WorkerMessage =
  | { type: 'load'; modelId: string; dtype?: Dtype }
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
      generator = await pipeline('text-generation', msg.modelId, {
        device: 'webgpu',
        dtype: msg.dtype ?? 'q4f16',
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
