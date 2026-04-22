import Color from 'color'
import { normalizePickerColor } from '~/shared/utils/color'
import type { CanvasPaintPropertyBinding, CanvasPaintValue } from './canvas-property-types'

const CSS_VARIABLE_REFERENCE_PATTERN = /^var\(\s*(?:--[^),\s]+)\s*(?:,\s*[^)]+)?\)$/

function normalizeCanvasPaintOpacity(opacity: number): number {
  return Math.min(100, Math.max(0, Math.round(opacity)))
}

function normalizeCanvasPaintColor(color: string): string {
  const normalizedColor = normalizePickerColor(color)
  if (CSS_VARIABLE_REFERENCE_PATTERN.test(color.trim()) && normalizedColor === '#000000') {
    return color.trim()
  }

  return Color(normalizedColor).rgb().string()
}

function normalizeCanvasPaintValue(value: CanvasPaintValue): CanvasPaintValue {
  return {
    color: normalizeCanvasPaintColor(value.color),
    opacity: normalizeCanvasPaintOpacity(value.opacity),
  }
}

export function areCanvasPaintValuesEqual(
  left: CanvasPaintValue,
  right: CanvasPaintValue,
): boolean {
  const normalizedLeft = normalizeCanvasPaintValue(left)
  const normalizedRight = normalizeCanvasPaintValue(right)

  return (
    normalizedLeft.opacity === normalizedRight.opacity &&
    normalizedLeft.color === normalizedRight.color
  )
}

export function readCanvasPaintBindingValue(binding: CanvasPaintPropertyBinding): CanvasPaintValue {
  const color = binding.getColor()

  return color === null
    ? {
        color: binding.definition.defaultValue.color,
        opacity: 0,
      }
    : {
        color,
        opacity: binding.getOpacity(),
      }
}
