import Color from 'color'

export interface PaintColorValue {
  color: string
  opacity: number
}

const CSS_VARIABLE_REFERENCE_PATTERN = /^var\(\s*(--[^),\s]+)\s*(?:,\s*[^)]+)?\)$/

export function paintColorValuesEqual(left: PaintColorValue, right: PaintColorValue): boolean {
  const normalizedLeftOpacity = normalizePaintOpacity(left.opacity)
  const normalizedRightOpacity = normalizePaintOpacity(right.opacity)
  if (normalizedLeftOpacity !== normalizedRightOpacity) {
    return false
  }

  const leftColor = left.color.trim()
  const rightColor = right.color.trim()
  if (leftColor === rightColor) {
    return true
  }

  if (isCssVariableReference(leftColor) && isCssVariableReference(rightColor)) {
    return false
  }

  return normalizePaintColor(leftColor) === normalizePaintColor(rightColor)
}

function normalizePaintOpacity(opacity: number): number {
  return Math.min(100, Math.max(0, Math.round(opacity)))
}

function normalizePaintColor(color: string): string {
  const trimmedColor = color.trim()
  const cssVariableMatch = trimmedColor.match(CSS_VARIABLE_REFERENCE_PATTERN)
  if (cssVariableMatch) {
    if (typeof document === 'undefined') return trimmedColor

    const resolvedValue = getComputedStyle(document.documentElement)
      .getPropertyValue(cssVariableMatch[1])
      .trim()
    if (!resolvedValue) return trimmedColor
    return normalizeResolvedColor(resolvedValue) ?? trimmedColor
  }

  return normalizeResolvedColor(trimmedColor) ?? '#000000'
}

function isCssVariableReference(color: string): boolean {
  return CSS_VARIABLE_REFERENCE_PATTERN.test(color)
}

function normalizeResolvedColor(color: string): string | null {
  try {
    return Color(color).rgb().string()
  } catch {
    return null
  }
}
