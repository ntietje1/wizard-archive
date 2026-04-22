import { assert, describe, expect, it } from 'vitest'
import { resolveCanvasProperties } from '../resolve-canvas-properties'
import { bindCanvasPaintProperty } from '../canvas-property-types'
import type { CanvasPaintPropertyDefinition } from '../canvas-property-types'

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
})
