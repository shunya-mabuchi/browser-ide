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
