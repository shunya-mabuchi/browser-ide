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
