import { useEffect, useState } from 'react'
import { Cpu, Zap, AlertTriangle, CheckCircle } from 'lucide-react'
import { detectHardware, getModelOptions, type HardwareInfo, type ModelOption } from '../lib/hardware'

interface Props {
  onSelect: (modelId: string) => void
  isLoading: boolean
  loadProgress: number
  loadText: string
}

export function ModelSelector({ onSelect, isLoading, loadProgress, loadText }: Props) {
  const [hw, setHw] = useState<HardwareInfo | null>(null)
  const [models, setModels] = useState<ModelOption[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    detectHardware().then((info) => {
      setHw(info)
      const opts = getModelOptions(info)
      setModels(opts)
      setSelected(opts.find((m) => m.recommended)?.id ?? opts[2].id)
    })
  }, [])

  if (!hw) {
    return <div className="text-gray-500 text-sm">ハードウェアを検出中...</div>
  }

  return (
    <div className="flex flex-col gap-4 p-6 max-w-md w-full">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        {hw.hasWebGPU ? (
          <>
            <Zap size={14} className="text-green-400" />
            <span>GPU: {hw.gpuDevice || hw.gpuVendor || '検出済み'}</span>
          </>
        ) : (
          <>
            <Cpu size={14} className="text-yellow-400" />
            <span>WebGPU 未対応 — CPU動作（低速）</span>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {models.map((model) => (
          <button
            key={model.id}
            onClick={() => setSelected(model.id)}
            disabled={isLoading}
            className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
              selected === model.id
                ? 'border-violet-500 bg-violet-500/10'
                : 'border-gray-700 hover:border-gray-500'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-200">{model.name}</span>
                <span className="text-xs text-gray-500">{model.sizeLabel}</span>
                {model.recommended && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400">
                    推奨
                  </span>
                )}
              </div>
              {model.warning && (
                <div className="flex items-center gap-1 mt-1">
                  <AlertTriangle size={11} className="text-yellow-500" />
                  <span className="text-xs text-yellow-500">{model.warning}</span>
                </div>
              )}
            </div>
            {selected === model.id && (
              <CheckCircle size={16} className="text-violet-400 mt-0.5 shrink-0" />
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 transition-all duration-300"
              style={{ width: `${loadProgress * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 truncate">{loadText}</p>
        </div>
      ) : (
        <button
          onClick={() => selected && onSelect(selected)}
          disabled={!selected}
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          モデルを読み込む
        </button>
      )}
    </div>
  )
}
