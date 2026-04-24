import { assert, describe, expect, it, vi } from 'vitest'
import { resolveCanvasProperties } from '../resolve-canvas-properties'
import { bindCanvasPaintProperty, bindCanvasStrokeSizeProperty } from '../canvas-property-types'
import type {
  CanvasPaintPropertyDefinition,
  CanvasStrokeSizeResolvedProperty,
  CanvasStrokeSizePropertyDefinition,
} from '../canvas-property-types'

const testPaintProperty: CanvasPaintPropertyDefinition = {
  id: 'fill',
  kind: 'paint',
  label: 'Fill',
  defaultValue: { color: '#ffffff', opacity: 100 },
  options: [
    { label: 'Default', value: { color: '#ffffff', opacity: 100 } },
    { label: 'Clear', value: { color: '#ffffff', opacity: 0 } },
    { label: 'Red', value: { color: '#ff0000', opacity: 100 } },
  ],
}

const testStrokeSizeProperty: CanvasStrokeSizePropertyDefinition = {
  id: 'strokeSize',
  kind: 'strokeSize',
  label: 'Stroke size',
  options: [1, 2, 4, 8],
  min: 0,
  max: 99,
}

describe('resolveCanvasProperties', () => {
  it('treats equivalent rgb values with the same opacity as a shared paint value', () => {
    const properties = resolveCanvasProperties([
      {
        bindings: [
          bindCanvasPaintProperty(testPaintProperty, {
            getColor: () => '#ff0000',
            setColor: () => {},
            getOpacity: () => 75,
            setOpacity: () => {},
          }),
        ],
      },
      {
        bindings: [
          bindCanvasPaintProperty(testPaintProperty, {
            getColor: () => 'rgb(255, 0, 0)',
            setColor: () => {},
            getOpacity: () => 75,
            setOpacity: () => {},
          }),
        ],
      },
    ])

    expect(properties).toHaveLength(1)
    assert(properties[0]?.definition.kind === 'paint')
    expect(properties[0].value).toEqual({
      kind: 'value',
      value: {
        color: '#ff0000',
        opacity: 75,
      },
    })
  })

  it('treats matching colors with different opacity as mixed', () => {
    const properties = resolveCanvasProperties([
      {
        bindings: [
          bindCanvasPaintProperty(testPaintProperty, {
            getColor: () => '#ff0000',
            setColor: () => {},
            getOpacity: () => 0,
            setOpacity: () => {},
          }),
        ],
      },
      {
        bindings: [
          bindCanvasPaintProperty(testPaintProperty, {
            getColor: () => '#ff0000',
            setColor: () => {},
            getOpacity: () => 100,
            setOpacity: () => {},
          }),
        ],
      },
    ])

    expect(properties).toHaveLength(1)
    assert(properties[0]?.definition.kind === 'paint')
    expect(properties[0].value).toEqual({ kind: 'mixed' })
  })

  it('resolves numeric properties through the shared typed binding contract', () => {
    const setValue = vi.fn()
    const properties = resolveCanvasProperties([
      {
        bindings: [bindCanvasStrokeSizeProperty(testStrokeSizeProperty, () => 4, setValue)],
      },
      {
        bindings: [bindCanvasStrokeSizeProperty(testStrokeSizeProperty, () => 4, setValue)],
      },
    ])

    expect(properties).toHaveLength(1)
    const strokeSizeProperty = properties[0]
    assert(strokeSizeProperty?.definition.kind === 'strokeSize')
    const resolvedStrokeSizeProperty = strokeSizeProperty as CanvasStrokeSizeResolvedProperty

    expect(resolvedStrokeSizeProperty.value).toEqual({ kind: 'value', value: 4 })

    resolvedStrokeSizeProperty.setValue(6)
    expect(setValue).toHaveBeenCalledTimes(2)
    expect(setValue).toHaveBeenCalledWith(6)
  })

  it('keeps stroke-size bindings mixed when selected values differ', () => {
    const properties = resolveCanvasProperties([
      {
        bindings: [
          bindCanvasStrokeSizeProperty(
            testStrokeSizeProperty,
            () => 2,
            () => {},
          ),
        ],
      },
      {
        bindings: [
          bindCanvasStrokeSizeProperty(
            testStrokeSizeProperty,
            () => 8,
            () => {},
          ),
        ],
      },
    ])

    expect(properties).toHaveLength(1)
    assert(properties[0]?.definition.kind === 'strokeSize')
    expect(properties[0].value).toEqual({ kind: 'mixed' })
  })
})
