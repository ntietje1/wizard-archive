type CanvasPropertyKind = 'paint' | 'strokeSize'

type CanvasPropertyBase<TKind extends CanvasPropertyKind, TValue> = {
  id: string
  kind: TKind
  label: string
  equals?: (left: TValue, right: TValue) => boolean
}

export interface CanvasPaintValue {
  color: string
  opacity: number
}

export interface CanvasPaintPreset {
  label: string
  value: CanvasPaintValue
}

export type CanvasPaintPropertyDefinition = CanvasPropertyBase<'paint', CanvasPaintValue> & {
  defaultValue: CanvasPaintValue
  options: ReadonlyArray<CanvasPaintPreset>
  showOpacity?: boolean
}

export type CanvasStrokeSizePropertyDefinition = CanvasPropertyBase<'strokeSize', number> & {
  options: ReadonlyArray<number>
  min: number
  max: number
  step?: number
}

type CanvasAnyPropertyDefinition =
  | CanvasPaintPropertyDefinition
  | CanvasStrokeSizePropertyDefinition

export type CanvasPropertyValue<TValue> = { kind: 'value'; value: TValue } | { kind: 'mixed' }

type CanvasPropertyBindingBase<TValue, TDefinition extends CanvasAnyPropertyDefinition> = {
  definition: TDefinition
  getPropertyValue?: () => CanvasPropertyValue<TValue>
  getValue: () => TValue
  setValue: (value: TValue) => void
}

export interface CanvasPaintPropertyBinding extends CanvasPropertyBindingBase<
  CanvasPaintValue,
  CanvasPaintPropertyDefinition
> {
  getColor: () => string | null
  setColor: (color: string) => void
  getOpacity: () => number
  setOpacity: (opacity: number) => void
}

export type CanvasStrokeSizePropertyBinding = CanvasPropertyBindingBase<
  number,
  CanvasStrokeSizePropertyDefinition
>

export type CanvasPropertyBinding = CanvasPaintPropertyBinding | CanvasStrokeSizePropertyBinding

interface CanvasResolvedPropertyBase<TValue, TDefinition extends CanvasAnyPropertyDefinition> {
  definition: TDefinition
  value: CanvasPropertyValue<TValue>
  setValue: (value: TValue) => void
}

export type CanvasPaintResolvedProperty = CanvasResolvedPropertyBase<
  CanvasPaintValue,
  CanvasPaintPropertyDefinition
>

export type CanvasStrokeSizeResolvedProperty = CanvasResolvedPropertyBase<
  number,
  CanvasStrokeSizePropertyDefinition
>

export type CanvasResolvedProperty = CanvasPaintResolvedProperty | CanvasStrokeSizeResolvedProperty

export interface CanvasInspectableProperties {
  bindings: Array<CanvasPropertyBinding>
}

export const EMPTY_CANVAS_INSPECTABLE_PROPERTIES: CanvasInspectableProperties = {
  bindings: [],
}

export function bindCanvasPaintProperty(
  definition: CanvasPaintPropertyDefinition,
  binding: Omit<CanvasPaintPropertyBinding, 'definition' | 'getValue' | 'setValue'> & {
    setValue?: (value: CanvasPaintValue) => void
  },
): CanvasPaintPropertyBinding {
  return {
    ...binding,
    definition,
    getValue: () => {
      const color = binding.getColor()

      return color === null
        ? {
            color: definition.defaultValue.color,
            opacity: 0,
          }
        : {
            color,
            opacity: binding.getOpacity(),
          }
    },
    setValue: (value) => {
      if (binding.setValue) {
        binding.setValue(value)
        return
      }

      binding.setColor(value.color)
      binding.setOpacity(value.opacity)
    },
  }
}

export function bindCanvasStrokeSizeProperty(
  definition: CanvasStrokeSizePropertyDefinition,
  getValue: () => number,
  setValue: (value: number) => void,
): CanvasStrokeSizePropertyBinding {
  return {
    definition,
    getValue,
    setValue,
  }
}

export function readResolvedPropertyValue<TValue>(
  property: { value: CanvasPropertyValue<TValue> } | undefined,
): TValue | undefined {
  if (!property || property.value.kind !== 'value') {
    return undefined
  }

  return property.value.value
}
