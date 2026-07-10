import { paintColorValuesEqual } from '@wizard-archive/ui/utils/paint-color-values'
import type { CanvasPaintValue } from './canvas-property-types'

export function areCanvasPaintValuesEqual(
  left: CanvasPaintValue,
  right: CanvasPaintValue,
): boolean {
  return paintColorValuesEqual(left, right)
}
