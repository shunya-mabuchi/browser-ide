const KEY = {
  lastModel: 'bide.lastModel',
  autoLoadModel: 'bide.autoLoadModel',
  autoDiff: 'bide.autoDiff',
} as const

function getString(key: string): string | null {
  return localStorage.getItem(key)
}

function setString(key: string, value: string): void {
  localStorage.setItem(key, value)
}

function getBool(key: string, defaultValue: boolean): boolean {
  const raw = localStorage.getItem(key)
  if (raw === null) return defaultValue
  return raw === 'true'
}

function setBool(key: string, value: boolean): void {
  localStorage.setItem(key, value ? 'true' : 'false')
}

export const storage = {
  lastModel: {
    get: (): string | null => getString(KEY.lastModel),
    set: (modelId: string): void => setString(KEY.lastModel, modelId),
    clear: (): void => localStorage.removeItem(KEY.lastModel),
  },
  autoLoadModel: {
    get: (): boolean => getBool(KEY.autoLoadModel, true),
    set: (value: boolean): void => setBool(KEY.autoLoadModel, value),
  },
  autoDiff: {
    get: (): boolean => getBool(KEY.autoDiff, true),
    set: (value: boolean): void => setBool(KEY.autoDiff, value),
  },
}
