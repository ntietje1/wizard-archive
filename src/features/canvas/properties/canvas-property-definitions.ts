import { BASE_BG_COLORS, BASE_TEXT_COLORS } from '~/shared/utils/color'
import type {
  CanvasPaintPreset,
  CanvasPaintPropertyDefinition,
  CanvasPaintValue,
  CanvasStrokeSizePropertyDefinition,
} from './canvas-property-types'

export const STROKE_SIZE_OPTIONS = [2, 4, 6, 8, 10, 12, 14, 16, 20, 24] as const
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
const DEFAULT_BORDER_VALUE = createPaintValue('var(--border)')

export const paintCanvasProperty: CanvasPaintPropertyDefinition = {
  id: 'paint',
  kind: 'paint',
  label: 'Stroke',
  defaultValue: DEFAULT_STROKE_VALUE,
  options: createPaintOptions(DEFAULT_STROKE_VALUE, BASE_TEXT_COLORS),
}

export const fillCanvasProperty: CanvasPaintPropertyDefinition = {
  id: 'fill',
  kind: 'paint',
  label: 'Fill',
  defaultValue: DEFAULT_FILL_VALUE,
  options: createPaintOptions(DEFAULT_FILL_VALUE, BASE_BG_COLORS),
}

export const borderStrokeCanvasProperty: CanvasPaintPropertyDefinition = {
  id: 'borderStroke',
  kind: 'paint',
  label: 'Border',
  defaultValue: DEFAULT_BORDER_VALUE,
  options: createPaintOptions(DEFAULT_BORDER_VALUE, BASE_TEXT_COLORS),
}

export const strokeSizeCanvasProperty: CanvasStrokeSizePropertyDefinition = {
  id: 'strokeSize',
  kind: 'strokeSize',
  label: 'Stroke size',
  options: STROKE_SIZE_OPTIONS,
  min: 1,
  max: 32,
  step: 1,
}
