import Color from 'color'

export interface NamedColorOption {
  color: string
  label: string
}

export function getContrastColor(hexColor: string): string {
  let hex = hexColor.trim().replace('#', '')
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    throw new TypeError(`Invalid hex color: "${hexColor}"`)
  }
  const rRaw = parseInt(hex.substring(0, 2), 16) / 255
  const gRaw = parseInt(hex.substring(2, 4), 16) / 255
  const bRaw = parseInt(hex.substring(4, 6), 16) / 255
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const luminance = 0.2126 * toLinear(rRaw) + 0.7152 * toLinear(gRaw) + 0.0722 * toLinear(bRaw)
  return luminance > 0.179 ? '#000000' : '#ffffff'
}

export const BASE_TEXT_COLORS: ReadonlyArray<NamedColorOption> = [
  { color: 'var(--background)', label: 'Primary' },
  { color: 'var(--foreground)', label: 'Reverse primary' },
  { color: 'var(--t-red)', label: 'Red' },
  { color: 'var(--t-orange)', label: 'Orange' },
  { color: 'var(--t-yellow)', label: 'Yellow' },
  { color: 'var(--t-green)', label: 'Green' },
  { color: 'var(--t-blue)', label: 'Blue' },
  { color: 'var(--t-purple)', label: 'Purple' },
  { color: 'var(--t-pink)', label: 'Pink' },
]

export const BASE_BG_COLORS: ReadonlyArray<NamedColorOption> = [
  { color: 'var(--background)', label: 'Primary' },
  { color: 'var(--foreground)', label: 'Reverse primary' },
  { color: 'var(--t-red)', label: 'Red' },
  { color: 'var(--t-orange)', label: 'Orange' },
  { color: 'var(--t-yellow)', label: 'Yellow' },
  { color: 'var(--t-green)', label: 'Green' },
  { color: 'var(--t-blue)', label: 'Blue' },
  { color: 'var(--t-purple)', label: 'Purple' },
  { color: 'var(--t-pink)', label: 'Pink' },
]

const CSS_VARIABLE_REFERENCE_PATTERN = /^var\(\s*(--[^),\s]+)\s*(?:,\s*[^)]+)?\)$/

function resolveDocumentCssVariable(variableName: string): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  const resolvedValue = getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim()

  return resolvedValue || null
}

export function normalizePickerColor(
  value: string | undefined,
  resolveCssVariable: (variableName: string) => string | null = resolveDocumentCssVariable,
): string {
  const normalizedValue = value?.trim()
  if (!normalizedValue) {
    return '#000000'
  }

  const cssVariableMatch = normalizedValue.match(CSS_VARIABLE_REFERENCE_PATTERN)
  const resolvedValue = cssVariableMatch
    ? (resolveCssVariable(cssVariableMatch[1]) ?? '#000000')
    : normalizedValue

  try {
    Color(resolvedValue)
    return resolvedValue
  } catch {
    return '#000000'
  }
}
