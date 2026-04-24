import { BASE_BG_COLORS, BASE_TEXT_COLORS } from '~/shared/utils/color'
import { areCanvasPaintValuesEqual } from './canvas-paint-values'
import type {
  CanvasPaintPreset,
  CanvasPaintPropertyDefinition,
  CanvasPaintValue,
  CanvasStrokeSizePropertyDefinition,
} from './canvas-property-types'

export const STROKE_SIZE_OPTIONS = [1, 2, 4, 6, 8, 10, 12, 16, 20, 24] as const
const FULL_OPACITY = 100 as const

function createPaintValue(color: string, opacity: number = FULL_OPACITY): CanvasPaintValue {
  return { color, opacity }
}

function createColorPresets(
  colors: ReadonlyArray<{ color: string; label: string }>,
): Array<CanvasPaintPreset> {
  return colors.map(({ color, label }) => ({
    label,
    value: createPaintValue(color),
  }))
}

function createPaintOptions(
  defaultValue: CanvasPaintValue,
  colors: ReadonlyArray<{ color: string; label: string }>,
): Array<CanvasPaintPreset> {
  const [primaryPreset, ...remainingColors] = createColorPresets(colors)
  if (!primaryPreset) {
    throw new Error('Paint swatch colors must include at least one preset.')
  }

  return [
    primaryPreset,
    { label: 'Clear', value: createPaintValue(defaultValue.color, 0) },
    ...remainingColors,
  ]
}

const DEFAULT_STROKE_VALUE = createPaintValue('var(--foreground)')
const DEFAULT_FILL_VALUE = createPaintValue('var(--background)')

export const linePaintCanvasProperty: CanvasPaintPropertyDefinition = {
  id: 'linePaint',
  kind: 'paint',
  label: 'Stroke',
  equals: areCanvasPaintValuesEqual,
  defaultValue: DEFAULT_STROKE_VALUE,
  options: createPaintOptions(DEFAULT_STROKE_VALUE, BASE_TEXT_COLORS),
}

export const fillCanvasProperty: CanvasPaintPropertyDefinition = {
  id: 'fill',
  kind: 'paint',
  label: 'Fill',
  equals: areCanvasPaintValuesEqual,
  defaultValue: DEFAULT_FILL_VALUE,
  options: createPaintOptions(DEFAULT_FILL_VALUE, BASE_BG_COLORS),
}

export const strokeSizeCanvasProperty: CanvasStrokeSizePropertyDefinition = {
  id: 'strokeSize',
  kind: 'strokeSize',
  label: 'Stroke size',
  options: STROKE_SIZE_OPTIONS,
  min: 0,
  max: 99,
  step: 1,
}

export const freehandStrokeSizeCanvasProperty: CanvasStrokeSizePropertyDefinition = {
  ...strokeSizeCanvasProperty,
  min: 1,
}
