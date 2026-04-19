type CanvasPropertyKind = 'paint' | 'strokeSize'

type CanvasPropertyBase<TKind extends CanvasPropertyKind> = {
  id: string
  kind: TKind
}

export type CanvasPaintPropertyDefinition = CanvasPropertyBase<'paint'> & {
  colors: ReadonlyArray<string>
}

export type CanvasStrokeSizePropertyDefinition = CanvasPropertyBase<'strokeSize'> & {
  options: ReadonlyArray<number>
  equals?: (left: unknown, right: unknown) => boolean
}

export type CanvasPropertyValue<TValue> = { kind: 'value'; value: TValue } | { kind: 'mixed' }

export interface CanvasPaintPropertyBinding {
  definition: CanvasPaintPropertyDefinition
  getColor: () => string
  setColor: (color: string) => void
  getOpacity: () => number
  setOpacity: (opacity: number) => void
}

export interface CanvasStrokeSizePropertyBinding {
  definition: CanvasStrokeSizePropertyDefinition
  getValue: () => number
  setValue: (value: number) => void
}

export type CanvasPropertyBinding = CanvasPaintPropertyBinding | CanvasStrokeSizePropertyBinding

export interface CanvasPaintResolvedProperty {
  definition: CanvasPaintPropertyDefinition
  color: CanvasPropertyValue<string>
  opacity: CanvasPropertyValue<number>
  setColor: (color: string) => void
  setOpacity: (opacity: number) => void
}

export interface CanvasStrokeSizeResolvedProperty {
  definition: CanvasStrokeSizePropertyDefinition
  value: CanvasPropertyValue<number>
  setValue: (value: number) => void
}

export type CanvasResolvedProperty = CanvasPaintResolvedProperty | CanvasStrokeSizeResolvedProperty

export interface CanvasInspectableProperties {
  bindings: Array<CanvasPropertyBinding>
}

export function bindCanvasPaintProperty(
  definition: CanvasPaintPropertyDefinition,
  binding: Omit<CanvasPaintPropertyBinding, 'definition'>,
): CanvasPaintPropertyBinding {
  return {
    definition,
    ...binding,
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

export function readResolvedPropertyValue(
  property: CanvasStrokeSizeResolvedProperty | undefined,
): number | undefined {
  if (!property || property.value.kind !== 'value') {
    return undefined
  }

  return property.value.value
}
