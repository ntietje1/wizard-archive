import { describe, expect, it } from 'vitest'
import {
  fillCanvasProperty,
  linePaintCanvasProperty,
  textColorCanvasProperty,
} from '../canvas-property-definitions'

describe('canvas property definitions', () => {
  it('keeps canvas text, stroke, and fill swatch palettes at ten options with safe text colors', () => {
    expect(textColorCanvasProperty.options).toHaveLength(10)
    expect(linePaintCanvasProperty.options).toHaveLength(10)
    expect(fillCanvasProperty.options).toHaveLength(10)

    expect(textColorCanvasProperty.options[0]).toMatchObject({
      label: 'Default',
      value: { color: 'var(--foreground)', opacity: 100 },
    })
    expect(textColorCanvasProperty.options[1]).toMatchObject({
      label: 'Grey',
      value: { color: 'var(--border)', opacity: 100 },
    })
    expect(textColorCanvasProperty.options[2]).toMatchObject({
      label: 'Brown',
      value: { color: 'var(--t-brown)', opacity: 100 },
    })
    expect(textColorCanvasProperty.options).not.toContainEqual(
      expect.objectContaining({ value: { color: 'var(--background)', opacity: 100 } }),
    )

    expect(linePaintCanvasProperty.options[1]).toMatchObject({
      label: 'Border',
      value: { color: 'var(--border)', opacity: 100 },
    })
    expect(fillCanvasProperty.options[1]).toMatchObject({
      label: 'Clear',
      value: { color: 'var(--background)', opacity: 0 },
    })
  })
})
