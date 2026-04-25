import * as webllm from '@mlc-ai/web-llm'

type WorkerMessage =
  | { type: 'load'; modelId: string }
  | { type: 'chat'; messages: webllm.ChatCompletionMessageParam[] }
  | { type: 'abort' }

type WorkerResponse =
  | { type: 'progress'; text: string; progress: number }
  | { type: 'chunk'; delta: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

let engine: webllm.MLCEngine | null = null

self.addEventListener('message', async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data

  if (msg.type === 'load') {
    try {
      engine = new webllm.MLCEngine()
      engine.setInitProgressCallback((report: webllm.InitProgressReport) => {
        const response: WorkerResponse = {
          type: 'progress',
          text: report.text,
          progress: report.progress,
        }
        self.postMessage(response)
      })
      await engine.reload(msg.modelId)
      self.postMessage({ type: 'done' } satisfies WorkerResponse)
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err) } satisfies WorkerResponse)
    }
    return
  }

  if (msg.type === 'chat') {
    if (!engine) {
      self.postMessage({ type: 'error', message: 'Model not loaded' } satisfies WorkerResponse)
      return
    }
    try {
      const stream = await engine.chat.completions.create({
        messages: msg.messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 2048,
      })
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? ''
        if (delta) {
          self.postMessage({ type: 'chunk', delta } satisfies WorkerResponse)
        }
      }
      self.postMessage({ type: 'done' } satisfies WorkerResponse)
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err) } satisfies WorkerResponse)
    }
    return
  }

  if (msg.type === 'abort') {
    engine?.interruptGenerate()
  }
})
