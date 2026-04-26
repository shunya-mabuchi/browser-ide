export type HardwareTier = 'high' | 'mid' | 'low' | 'cpu-only'

export interface HardwareInfo {
  hasWebGPU: boolean
  gpuVendor: string | null
  gpuDevice: string | null
  maxBufferSizeGB: number | null
  deviceMemoryGB: number | null
  tier: HardwareTier
}

export type ModelAxis = 'general' | 'coder' | 'reasoning'
export type ModelSizeTier = 'high' | 'mid' | 'low'

export interface ModelOption {
  id: string
  name: string
  sizeLabel: string
  axis: ModelAxis
  sizeTier: ModelSizeTier
  dtype: 'q4f16' | 'q4' | 'fp16' | 'int8'
  fim?: boolean
  recommended: boolean
  warning?: string
}

export async function detectHardware(): Promise<HardwareInfo> {
  if (!navigator.gpu) {
    return {
      hasWebGPU: false,
      gpuVendor: null,
      gpuDevice: null,
      maxBufferSizeGB: null,
      deviceMemoryGB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
      tier: 'cpu-only',
    }
  }

  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) {
    return {
      hasWebGPU: true,
      gpuVendor: null,
      gpuDevice: null,
      maxBufferSizeGB: null,
      deviceMemoryGB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
      tier: 'low',
    }
  }

  const adapterAny = adapter as GPUAdapter & { requestAdapterInfo?: () => Promise<{ vendor?: string; device?: string }> }
  const info = adapterAny.requestAdapterInfo ? await adapterAny.requestAdapterInfo() : {}
  const maxBufferSizeGB = adapter.limits.maxBufferSize / (1024 ** 3)
  const deviceMemoryGB = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null

  let tier: HardwareTier
  if (maxBufferSizeGB >= 6) {
    tier = 'high'
  } else if (maxBufferSizeGB >= 3) {
    tier = 'mid'
  } else {
    tier = 'low'
  }

  return {
    hasWebGPU: true,
    gpuVendor: (info as { vendor?: string }).vendor || null,
    gpuDevice: (info as { device?: string }).device || null,
    maxBufferSizeGB,
    deviceMemoryGB,
    tier,
  }
}

const ALL_MODELS: Omit<ModelOption, 'recommended' | 'warning'>[] = [
  // 高性能 5〜6GB帯
  {
    id: 'onnx-community/gemma-4-E4B-it-ONNX',
    name: 'Gemma 4 E4B',
    sizeLabel: '~4GB',
    axis: 'general',
    sizeTier: 'high',
    dtype: 'q4f16',
  },
  {
    id: 'onnx-community/Qwen3-8B-ONNX',
    name: 'Qwen3 8B',
    sizeLabel: '~5-6GB',
    axis: 'general',
    sizeTier: 'high',
    dtype: 'q4f16',
  },
  {
    id: 'onnx-community/Qwen2.5-Coder-7B-Instruct',
    name: 'Qwen2.5-Coder 7B',
    sizeLabel: '~5GB',
    axis: 'coder',
    sizeTier: 'high',
    dtype: 'q4f16',
    fim: true,
  },
  {
    id: 'onnx-community/DeepSeek-R1-Distill-Qwen-7B-ONNX',
    name: 'DeepSeek-R1-Distill 7B',
    sizeLabel: '~5GB',
    axis: 'reasoning',
    sizeTier: 'high',
    dtype: 'q4f16',
  },
  // 中性能 2〜4GB帯
  {
    id: 'onnx-community/Qwen3-4B-Instruct-2507-ONNX',
    name: 'Qwen3 4B',
    sizeLabel: '~3-4GB',
    axis: 'general',
    sizeTier: 'mid',
    dtype: 'q4f16',
  },
  {
    id: 'onnx-community/Qwen2.5-Coder-3B-Instruct',
    name: 'Qwen2.5-Coder 3B',
    sizeLabel: '~2GB',
    axis: 'coder',
    sizeTier: 'mid',
    dtype: 'q4f16',
    fim: true,
  },
  {
    id: 'onnx-community/Phi-4-mini-instruct-ONNX',
    name: 'Phi-4 Mini',
    sizeLabel: '~3GB',
    axis: 'reasoning',
    sizeTier: 'mid',
    dtype: 'q4f16',
  },
  // 低性能 ~1.5GB帯
  {
    id: 'onnx-community/Qwen2.5-Coder-1.5B-Instruct',
    name: 'Qwen2.5-Coder 1.5B',
    sizeLabel: '~1GB',
    axis: 'coder',
    sizeTier: 'low',
    dtype: 'q4f16',
    fim: true,
  },
  {
    id: 'onnx-community/Llama-3.2-1B-Instruct',
    name: 'Llama 3.2 1B',
    sizeLabel: '~0.6GB',
    axis: 'general',
    sizeTier: 'low',
    dtype: 'q4f16',
  },
]

export function getModelOptions(hw: HardwareInfo): ModelOption[] {
  const tierWarning = (sizeTier: ModelSizeTier): string | undefined => {
    if (hw.tier === 'cpu-only') {
      return sizeTier === 'low' ? '遅くなります（CPU動作）' : '非常に遅くなります（CPU動作）'
    }
    if (hw.tier === 'low' && sizeTier !== 'low') {
      return 'GPUメモリ不足の可能性があります'
    }
    if (hw.tier === 'mid' && sizeTier === 'high') {
      return 'GPUメモリが厳しい可能性があります'
    }
    return undefined
  }

  const recommendedTier: ModelSizeTier =
    hw.tier === 'high' ? 'high' :
    hw.tier === 'mid' ? 'mid' :
    'low'

  // Default recommendation: コーディング用途優先で coder 軸の同サイズを推奨
  let recommendedSet = false

  return ALL_MODELS.map((m) => {
    const isRecommended = !recommendedSet && m.sizeTier === recommendedTier && m.axis === 'coder'
    if (isRecommended) recommendedSet = true
    return {
      ...m,
      recommended: isRecommended,
      warning: tierWarning(m.sizeTier),
    }
  })
}
