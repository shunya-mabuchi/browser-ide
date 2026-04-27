import { useEffect, useMemo, useState } from 'react'
import {
  detectHardware,
  getModelOptions,
  type HardwareInfo,
  type ModelAxis,
  type ModelOption,
  type ModelSizeTier,
} from '../lib/hardware'

interface Props {
  onSelect: (modelId: string, displayName: string) => void
  isLoading: boolean
  loadProgress: number
  loadText: string
  isModal?: boolean
  onCancel?: () => void
}

const TIER_LABEL: Record<ModelSizeTier, string> = {
  high: '高性能 5〜6GB帯',
  mid: '中性能 2〜4GB帯',
  low: '低性能 ~1.5GB帯',
}

const AXIS_LABEL: Record<ModelAxis, string> = {
  general: '汎用',
  coder: 'コーディング',
  reasoning: '推論',
}

const AXIS_COLOR: Record<ModelAxis, string> = {
  general: 'var(--text-muted)',
  coder: 'var(--green)',
  reasoning: 'var(--amber)',
}

export function ModelSelector({
  onSelect,
  isLoading,
  loadProgress,
  loadText,
  isModal = false,
  onCancel,
}: Props) {
  const [hw, setHw] = useState<HardwareInfo | null>(null)
  const [models, setModels] = useState<ModelOption[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  useEffect(() => {
    detectHardware().then((info) => {
      setHw(info)
      const opts = getModelOptions(info)
      setModels(opts)
      setSelected(opts.find((m) => m.recommended)?.id ?? opts[0].id)
    })
  }, [])

  const selectedIndex = models.findIndex((m) => m.id === selected)

  const groupedModels = useMemo(() => {
    const groups: Record<ModelSizeTier, ModelOption[]> = { high: [], mid: [], low: [] }
    for (const m of models) groups[m.sizeTier].push(m)
    return groups
  }, [models])

  const rootClass = isModal
    ? 'animate-screen-in flex flex-col w-full'
    : 'animate-screen-in flex flex-col items-center justify-center min-h-screen w-full'
  const rootStyle = isModal
    ? { background: 'var(--surface)' }
    : { background: 'var(--bg)' }

  return (
    <div className={rootClass} style={rootStyle}>
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

        <div className="p-2 overflow-y-auto" style={{ maxHeight: isModal ? '60vh' : '52vh' }}>
          {!hw ? (
            <div className="py-10 text-center text-base tabular" style={{ color: 'var(--text-dim)' }}>
              ハードウェアを検出中<span className="cursor-blink">_</span>
            </div>
          ) : (
            (['high', 'mid', 'low'] as ModelSizeTier[]).map((tier) => {
              const tierModels = groupedModels[tier]
              if (tierModels.length === 0) return null
              return (
                <div key={tier} className="mb-2 last:mb-0">
                  <div
                    className="px-5 pt-2 pb-1 text-xs tabular"
                    style={{ color: 'var(--text-dim)', letterSpacing: '0.1em' }}
                  >
                    {TIER_LABEL[tier]}
                  </div>
                  {tierModels.map((model) => {
                    const isSelected = model.id === selected
                    const i = models.findIndex((m) => m.id === model.id)
                    const isHovered = hoveredIndex === i
                    return (
                      <button
                        key={model.id}
                        onClick={() => setSelected(model.id)}
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        disabled={isLoading}
                        className="press w-full flex items-center gap-3 px-5 py-3 text-left disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          background: isSelected ? 'var(--amber-dim)' : isHovered ? 'var(--surface2)' : 'transparent',
                          borderLeft: isSelected ? '3px solid var(--amber-strong)' : '3px solid transparent',
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="text-base font-medium"
                              style={{ color: isSelected ? 'var(--amber-strong)' : 'var(--text)' }}
                            >
                              {model.name}
                            </span>
                            <span
                              className="px-1.5 py-0.5 text-xs tabular"
                              style={{
                                color: AXIS_COLOR[model.axis],
                                border: `1px solid ${AXIS_COLOR[model.axis]}`,
                                letterSpacing: '0.06em',
                                opacity: 0.7,
                              }}
                            >
                              {AXIS_LABEL[model.axis]}
                            </span>
                            {model.fim && (
                              <span
                                className="px-1.5 py-0.5 text-xs tabular"
                                style={{
                                  color: 'var(--green)',
                                  border: '1px solid var(--green)',
                                  letterSpacing: '0.06em',
                                  opacity: 0.6,
                                }}
                                title="Fill-in-the-Middle 対応（コード補完UIで使用予定）"
                              >
                                FIM
                              </span>
                            )}
                            {model.recommended && (
                              <span
                                className="px-1.5 py-0.5 text-xs tabular"
                                style={{
                                  color: 'var(--amber)',
                                  border: '1px solid var(--amber-mute)',
                                  letterSpacing: '0.08em',
                                }}
                              >
                                推奨
                              </span>
                            )}
                          </div>
                          {model.warning && (
                            <div className="text-xs mt-1" style={{ color: 'var(--amber-mute)' }}>
                              ⚠ {model.warning}
                            </div>
                          )}
                        </div>
                        <span
                          className="text-sm shrink-0 tabular"
                          style={{ color: isSelected ? 'var(--amber)' : 'var(--text-dim)' }}
                        >
                          {model.sizeLabel}
                        </span>
                        <span
                          className="w-4 h-4 shrink-0 flex items-center justify-center"
                          style={{ border: `2px solid ${isSelected ? 'var(--amber-strong)' : 'var(--border2)'}` }}
                        >
                          {isSelected && (
                            <span className="w-2 h-2 block" style={{ background: 'var(--amber-strong)' }} />
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        {hw && (
          <div
            className="px-6 py-3 flex items-center justify-between tabular"
            style={{ borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}
          >
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {hw.gpuDevice || hw.gpuVendor || (hw.hasWebGPU ? 'GPU 検出済み' : 'GPUなし')}
            </span>
            {hw.deviceMemoryGB && (
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                RAM {hw.deviceMemoryGB}GB
              </span>
            )}
          </div>
        )}

        <div className="p-5" style={{ borderTop: '1px solid var(--border)' }}>
          {isLoading ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between tabular">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  読み込み中<span className="cursor-blink">_</span>
                </span>
                <span className="text-sm" style={{ color: 'var(--amber-strong)' }}>
                  {Math.round(loadProgress * 100).toString().padStart(2, '0')}%
                </span>
              </div>
              <div className="h-0.5 w-full" style={{ background: 'var(--border2)' }}>
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${loadProgress * 100}%`,
                    background: 'var(--amber-strong)',
                    boxShadow: '0 0 8px var(--amber)',
                  }}
                />
              </div>
              <p className="text-xs truncate tabular" style={{ color: 'var(--text-dim)' }}>
                {loadText}
              </p>
            </div>
          ) : (
            <button
              onClick={() => {
                if (!selected) return
                const model = models.find((m) => m.id === selected)
                onSelect(selected, model?.name ?? selected)
              }}
              disabled={!selected || !hw}
              className="press w-full py-4 text-base font-medium disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                color: 'var(--bg)',
                background: 'var(--amber-strong)',
                boxShadow: '0 0 24px var(--amber-glow)',
                letterSpacing: '0.05em',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--amber)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--amber-strong)' }}
            >
              開始する
            </button>
          )}
        </div>
      </div>

      {!isModal && (
        <div className="mt-6 text-xs tabular" style={{ color: 'var(--text-dim)' }}>
          {selectedIndex >= 0 && models[selectedIndex] && (
            <>初回のみ {models[selectedIndex].sizeLabel} のダウンロードが発生します</>
          )}
        </div>
      )}
    </div>
  )
}
