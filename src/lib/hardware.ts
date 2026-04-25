export type HardwareTier = 'high' | 'mid' | 'low' | 'cpu-only'

export interface HardwareInfo {
  hasWebGPU: boolean
  gpuVendor: string | null
  gpuDevice: string | null
  maxBufferSizeGB: number | null
  deviceMemoryGB: number | null
  tier: HardwareTier
}

export interface ModelOption {
  id: string
  name: string
  sizeLabel: string
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

export function getModelOptions(hw: HardwareInfo): ModelOption[] {
  const models: ModelOption[] = [
    {
      id: 'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC',
      name: 'Qwen2.5-Coder 7B',
      sizeLabel: '~4GB',
      recommended: false,
      warning: hw.tier === 'cpu-only' ? '非常に遅くなります（CPU動作）' : undefined,
    },
    {
      id: 'Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC',
      name: 'Qwen2.5-Coder 3B',
      sizeLabel: '~2GB',
      recommended: false,
      warning: hw.tier === 'cpu-only' ? '非常に遅くなります（CPU動作）' : undefined,
    },
    {
      id: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
      name: 'Qwen2.5-Coder 1.5B',
      sizeLabel: '~1GB',
      recommended: false,
      warning: hw.tier === 'cpu-only' ? '遅くなります（CPU動作）' : undefined,
    },
  ]

  const recommendedIndex =
    hw.tier === 'high' ? 0 :
    hw.tier === 'mid' ? 1 :
    2

  models[recommendedIndex].recommended = true
  return models
}
