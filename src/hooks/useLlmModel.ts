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

  const loadModelInternal = useCallback((opts: LoadOptions, hw: HardwareInfo) => {
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

  // Auto-restore last model when hardware is ready
  useEffect(() => {
    if (!hardware) return
    if (!storage.autoLoadModel.get()) return
    const lastId = storage.lastModel.get()
    if (!lastId) return
    if (state.kind !== 'idle') return
    loadModelInternal({ modelId: lastId }, hardware)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hardware])

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
