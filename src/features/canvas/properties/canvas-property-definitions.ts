import { BASE_TEXT_COLORS } from '~/shared/utils/color'
import type {
  CanvasPaintPropertyDefinition,
  CanvasStrokeSizePropertyDefinition,
} from './canvas-property-types'

export const STROKE_SIZE_OPTIONS = [2, 4, 8, 16] as const

export const paintCanvasProperty: CanvasPaintPropertyDefinition = {
  id: 'paint',
  kind: 'paint',
  colors: BASE_TEXT_COLORS,
}

export const strokeSizeCanvasProperty: CanvasStrokeSizePropertyDefinition = {
  id: 'strokeSize',
  kind: 'strokeSize',
  options: STROKE_SIZE_OPTIONS,
}
