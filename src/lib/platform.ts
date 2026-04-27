// Cross-platform key label helper
// Mac: ⌘B / ⌘⇧Z
// Windows/Linux: Ctrl+B / Ctrl+Shift+Z

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export const MOD_LABEL = isMac ? '⌘' : 'Ctrl+'
export const SHIFT_LABEL = isMac ? '⇧' : 'Shift+'
export const ALT_LABEL = isMac ? '⌥' : 'Alt+'

export function key(...parts: string[]): string {
  if (isMac) {
    return parts
      .map((p) => p
        .replace(/^Mod$/i, '⌘')
        .replace(/^Shift$/i, '⇧')
        .replace(/^Alt$/i, '⌥')
        .replace(/^Enter$/i, 'Enter'))
      .join('')
  }
  return parts
    .map((p) => p
      .replace(/^Mod$/i, 'Ctrl')
      .replace(/^Shift$/i, 'Shift')
      .replace(/^Alt$/i, 'Alt'))
    .join('+')
}
