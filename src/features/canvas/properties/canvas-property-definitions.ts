import { BASE_TEXT_COLORS } from '~/shared/utils/color'
import type {
  CanvasPaintPropertyDefinition,
  CanvasStrokeSizePropertyDefinition,
} from './canvas-property-types'

export const STROKE_SIZE_OPTIONS = [2, 4, 8, 16] as const

export const paintCanvasProperty: CanvasPaintPropertyDefinition = {
  id: 'paint',
  kind: 'paint',
  label: 'Stroke',
  colors: BASE_TEXT_COLORS,
}

export const fillCanvasProperty: CanvasPaintPropertyDefinition = {
  id: 'fill',
  kind: 'paint',
  label: 'Fill',
  colors: BASE_TEXT_COLORS,
  allowNone: true,
  noneLabel: 'No fill',
}

export const borderStrokeCanvasProperty: CanvasPaintPropertyDefinition = {
  id: 'borderStroke',
  kind: 'paint',
  label: 'Border',
  colors: BASE_TEXT_COLORS,
  allowNone: true,
  noneLabel: 'No stroke',
}

export const strokeSizeCanvasProperty: CanvasStrokeSizePropertyDefinition = {
  id: 'strokeSize',
  kind: 'strokeSize',
  options: STROKE_SIZE_OPTIONS,
}
