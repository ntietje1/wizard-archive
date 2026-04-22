import { BASE_BG_COLORS, BASE_TEXT_COLORS } from '~/shared/utils/color'
import type {
  CanvasPaintPreset,
  CanvasPaintPropertyDefinition,
  CanvasPaintValue,
  CanvasStrokeSizePropertyDefinition,
} from './canvas-property-types'

export const STROKE_SIZE_OPTIONS = [1, 2, 4, 8, 12, 16, 24, 32] as const
const FULL_OPACITY = 100 as const

function createPaintValue(color: string, opacity: number = FULL_OPACITY): CanvasPaintValue {
  return { color, opacity }
}

function createColorPresets(colors: ReadonlyArray<string>): Array<CanvasPaintPreset> {
  return colors.map((color) => ({
    label: colorLabel(color),
    value: createPaintValue(color),
  }))
}

function colorLabel(color: string): string {
  switch (color) {
    case 'var(--t-red)':
    case 'var(--bg-red)':
      return 'Red'
    case 'var(--t-orange)':
    case 'var(--bg-orange)':
      return 'Orange'
    case 'var(--t-yellow)':
    case 'var(--bg-yellow)':
      return 'Yellow'
    case 'var(--t-green)':
    case 'var(--bg-green)':
      return 'Green'
    case 'var(--t-blue)':
    case 'var(--bg-blue)':
      return 'Blue'
    case 'var(--t-purple)':
    case 'var(--bg-purple)':
      return 'Purple'
    case 'var(--t-pink)':
    case 'var(--bg-pink)':
      return 'Pink'
    case 'var(--foreground)':
    case 'var(--background)':
    case 'var(--border)':
      return 'Primary'
    default:
      return 'Custom'
  }
}

function createPaintOptions(
  defaultValue: CanvasPaintValue,
  colors: ReadonlyArray<string>,
  extras: ReadonlyArray<CanvasPaintPreset>,
  includeDefault = true,
): Array<CanvasPaintPreset> {
  return [
    ...(includeDefault ? [{ label: 'Default', value: defaultValue }] : []),
    ...extras,
    ...createColorPresets(colors).filter(
      (preset) =>
        preset.value.color !== defaultValue.color || preset.value.opacity !== defaultValue.opacity,
    ),
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
  options: createPaintOptions(DEFAULT_STROKE_VALUE, BASE_TEXT_COLORS, [
    { label: 'Clear', value: createPaintValue(DEFAULT_STROKE_VALUE.color, 0) },
    { label: 'Reverse primary', value: createPaintValue('var(--background)') },
  ]),
}

export const fillCanvasProperty: CanvasPaintPropertyDefinition = {
  id: 'fill',
  kind: 'paint',
  label: 'Fill',
  defaultValue: DEFAULT_FILL_VALUE,
  options: createPaintOptions(DEFAULT_FILL_VALUE, BASE_BG_COLORS, [
    { label: 'Clear', value: createPaintValue(DEFAULT_FILL_VALUE.color, 0) },
    { label: 'Reverse primary', value: createPaintValue('var(--foreground)') },
  ]),
}

export const borderStrokeCanvasProperty: CanvasPaintPropertyDefinition = {
  id: 'borderStroke',
  kind: 'paint',
  label: 'Border',
  defaultValue: DEFAULT_BORDER_VALUE,
  options: createPaintOptions(
    DEFAULT_BORDER_VALUE,
    BASE_TEXT_COLORS,
    [
      { label: 'Clear', value: createPaintValue(DEFAULT_BORDER_VALUE.color, 0) },
      { label: 'Reverse primary', value: createPaintValue('var(--background)') },
    ],
    false,
  ),
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
