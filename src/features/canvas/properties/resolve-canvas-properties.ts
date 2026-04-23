import type {
  CanvasInspectableProperties,
  CanvasPaintPropertyBinding,
  CanvasPaintValue,
  CanvasPropertyBinding,
  CanvasPropertyValue,
  CanvasResolvedProperty,
  CanvasStrokeSizePropertyBinding,
} from './canvas-property-types'
import { areCanvasPaintValuesEqual, readCanvasPaintBindingValue } from './canvas-paint-values'
import { assertNever } from '~/shared/utils/utils'

function createValue<TValue>(isMixed: boolean, value: TValue): CanvasPropertyValue<TValue> {
  return isMixed ? { kind: 'mixed' } : { kind: 'value', value }
}

function createNumericValue(
  values: Array<number>,
  equals?: (left: unknown, right: unknown) => boolean,
): CanvasPropertyValue<number> {
  if (values.length === 0) {
    throw new RangeError('createNumericValue: values must be a non-empty array')
  }

  const [firstValue, ...restValues] = values
  const isMixed = restValues.some((value) =>
    equals ? !equals(firstValue, value) : !Object.is(firstValue, value),
  )

  return createValue(isMixed, firstValue)
}

function createNumericProperty(
  binding: CanvasStrokeSizePropertyBinding,
  matches: Array<CanvasStrokeSizePropertyBinding>,
): CanvasResolvedProperty {
  const min = Math.max(...matches.map((match) => match.definition.min))
  const max = Math.min(...matches.map((match) => match.definition.max))

  return {
    definition: {
      ...binding.definition,
      min,
      max,
    },
    value: createNumericValue(
      matches.map((match) => match.getValue()),
      binding.definition.equals,
    ),
    setValue: (nextValue: number) => {
      matches.forEach((match) => match.setValue(nextValue))
    },
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
  switch (binding.definition.kind) {
    case 'paint': {
      const paintMatches = matches as Array<CanvasPaintPropertyBinding>
      if (paintMatches.length === 0) {
        throw new RangeError('createResolvedProperty: paint matches must be a non-empty array')
      }

      const [firstValue, ...restValues] = paintMatches.map(readCanvasPaintBindingValue)
      const value = createValue(
        restValues.some((candidate) => !areCanvasPaintValuesEqual(candidate, firstValue)),
        firstValue,
      )

      return {
        definition: binding.definition,
        value,
        setValue: (nextValue: CanvasPaintValue) => {
          paintMatches.forEach((match) => {
            match.setColor(nextValue.color)
            match.setOpacity(nextValue.opacity)
          })
        },
        setColor: (nextColor: string) => {
          paintMatches.forEach((match) => match.setColor(nextColor))
        },
        setOpacity: (nextOpacity: number) => {
          paintMatches.forEach((match) => match.setOpacity(nextOpacity))
        },
      }
    }
    case 'strokeSize': {
      const strokeSizeBinding = binding as CanvasStrokeSizePropertyBinding
      const strokeSizeMatches = matches as Array<CanvasStrokeSizePropertyBinding>
      return createNumericProperty(strokeSizeBinding, strokeSizeMatches)
    }
    default:
      return assertNever(binding.definition)
  }
}
