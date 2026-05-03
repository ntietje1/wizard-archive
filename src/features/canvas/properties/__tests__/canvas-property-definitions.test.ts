import { describe, expect, it } from 'vitest'
import {
  fillCanvasProperty,
  linePaintCanvasProperty,
  textColorCanvasProperty,
} from '../canvas-property-definitions'

describe('canvas property definitions', () => {
  it('keeps canvas text, stroke, and fill swatch palettes at ten options with the expected second slot', () => {
    expect(textColorCanvasProperty.options).toHaveLength(10)
    expect(linePaintCanvasProperty.options).toHaveLength(10)
    expect(fillCanvasProperty.options).toHaveLength(10)

    expect(textColorCanvasProperty.options[1]).toMatchObject({
      label: 'Border',
      value: { color: 'var(--border)', opacity: 100 },
    })
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
