import type {
  CanvasInspectableProperties,
  CanvasPaintPropertyBinding,
  CanvasPaintResolvedProperty,
  CanvasPropertyBinding,
  CanvasPropertyValue,
  CanvasResolvedProperty,
  CanvasStrokeSizePropertyBinding,
  CanvasStrokeSizePropertyDefinition,
  CanvasStrokeSizeResolvedProperty,
} from './canvas-property-types'
import { areCanvasPaintValuesEqual } from './canvas-paint-values'
import { assertNever } from '~/shared/utils/utils'

function createValue<TValue>(isMixed: boolean, value: TValue): CanvasPropertyValue<TValue> {
  return isMixed ? { kind: 'mixed' } : { kind: 'value', value }
}

function createResolvedValue<TValue>(
  definition: { equals?: (left: TValue, right: TValue) => boolean },
  values: Array<TValue>,
): CanvasPropertyValue<TValue> {
  if (values.length === 0) {
    throw new RangeError('createResolvedValue: values must be a non-empty array')
  }

  const [firstValue, ...restValues] = values
  const isMixed = restValues.some((value) =>
    definition.equals ? !definition.equals(firstValue, value) : !Object.is(firstValue, value),
  )

  return createValue(isMixed, firstValue)
}

function createResolvedBindingValue<TValue>(
  definition: { equals?: (left: TValue, right: TValue) => boolean },
  bindings: Array<{ getPropertyValue?: () => CanvasPropertyValue<TValue>; getValue: () => TValue }>,
): CanvasPropertyValue<TValue> {
  const values = bindings.map(
    (binding) => binding.getPropertyValue?.() ?? createValue(false, binding.getValue()),
  )
  if (values.some((value) => value.kind === 'mixed')) {
    return { kind: 'mixed' }
  }

  const resolvedValues = values as Array<Extract<CanvasPropertyValue<TValue>, { kind: 'value' }>>
  return createResolvedValue(
    definition,
    resolvedValues.map((value) => value.value),
  )
}

function createPaintProperty(
  binding: CanvasPaintPropertyBinding,
  matches: Array<CanvasPaintPropertyBinding>,
): CanvasPaintResolvedProperty {
  const definition = {
    ...binding.definition,
    equals: binding.definition.equals ?? areCanvasPaintValuesEqual,
  }

  return {
    definition,
    value: createResolvedBindingValue(definition, matches),
    setValue: (nextValue: Parameters<CanvasPaintPropertyBinding['setValue']>[0]) => {
      matches.forEach((match) => match.setValue(nextValue))
    },
  }
}

function createStrokeSizeProperty(
  binding: CanvasStrokeSizePropertyBinding,
  matches: Array<CanvasStrokeSizePropertyBinding>,
): CanvasStrokeSizeResolvedProperty {
  const computedMin = Math.max(...matches.map((match) => match.definition.min))
  const computedMax = Math.min(...matches.map((match) => match.definition.max))
  // Keep the resolved range valid even when bindings provide conflicting min/max constraints.
  const min = Math.min(computedMin, computedMax)
  const max = computedMax

  return {
    definition: {
      ...binding.definition,
      min,
      max,
    } satisfies CanvasStrokeSizePropertyDefinition,
    value: createResolvedBindingValue(binding.definition, matches),
    setValue: (nextValue: number) => {
      matches.forEach((match) => match.setValue(nextValue))
    },
  }
}

function isPaintPropertyBinding(
  binding: CanvasPropertyBinding,
): binding is CanvasPaintPropertyBinding {
  return binding.definition.kind === 'paint'
}

function isStrokeSizePropertyBinding(
  binding: CanvasPropertyBinding,
): binding is CanvasStrokeSizePropertyBinding {
  return binding.definition.kind === 'strokeSize'
}

type CanvasPropertyBindingByKind = {
  paint: CanvasPaintPropertyBinding
  strokeSize: CanvasStrokeSizePropertyBinding
}

const canvasPropertyResolvers = {
  paint: createPaintProperty,
  strokeSize: createStrokeSizeProperty,
} satisfies {
  [TKind in keyof CanvasPropertyBindingByKind]: (
    binding: CanvasPropertyBindingByKind[TKind],
    matches: Array<CanvasPropertyBindingByKind[TKind]>,
  ) => CanvasResolvedProperty
}

function resolvePropertyByKind<TKind extends keyof CanvasPropertyBindingByKind>(
  kind: TKind,
  binding: CanvasPropertyBindingByKind[TKind],
  matches: Array<CanvasPropertyBinding>,
): CanvasResolvedProperty {
  switch (kind) {
    case 'paint':
      return canvasPropertyResolvers.paint(
        binding as CanvasPaintPropertyBinding,
        matches.filter(isPaintPropertyBinding),
      )
    case 'strokeSize':
      return canvasPropertyResolvers.strokeSize(
        binding as CanvasStrokeSizePropertyBinding,
        matches.filter(isStrokeSizePropertyBinding),
      )
    default:
      return assertNever(kind)
  }
}

export function resolveCanvasProperties(
  targets: ReadonlyArray<CanvasInspectableProperties | null | undefined>,
): Array<CanvasResolvedProperty> {
  if (targets.length === 0) {
    return []
  }

  const bindingSets = targets.map((target) => target?.bindings ?? [])
  const firstBindings = bindingSets[0]

  return firstBindings.flatMap((binding) => {
    const matches = bindingSets.map((bindings) =>
      bindings.find((candidate) => candidate.definition.id === binding.definition.id),
    )
    if (matches.some((match) => !match)) {
      return []
    }

    const resolvedMatches = matches as Array<CanvasPropertyBinding>
    return [createResolvedProperty(binding, resolvedMatches)]
  })
}

function createResolvedProperty(
  binding: CanvasPropertyBinding,
  matches: Array<CanvasPropertyBinding>,
): CanvasResolvedProperty {
  const kind = binding.definition.kind
  return resolvePropertyByKind(kind, binding as CanvasPropertyBindingByKind[typeof kind], matches)
}
