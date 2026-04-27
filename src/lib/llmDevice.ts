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
