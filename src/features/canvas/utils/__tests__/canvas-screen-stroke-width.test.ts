import { describe, expect, it } from 'vitest'
import {
  resolveCanvasScreenMinimumStrokeWidth,
  resolveCanvasScreenMinimumStrokeWidthCss,
} from '../canvas-screen-stroke-width'

describe('canvas screen stroke width', () => {
  it('keeps baseline widths unchanged at zoom 1', () => {
    expect(resolveCanvasScreenMinimumStrokeWidth(2, 1)).toBe(2)
    expect(resolveCanvasScreenMinimumStrokeWidthCss(2)).toBe(
      'max(2px, calc(1px / max(var(--canvas-zoom, 1), 0.0001)))',
    )
  })

  it('leaves authored widths unchanged when they are already at least one screen pixel', () => {
    expect(resolveCanvasScreenMinimumStrokeWidth(4, 0.5)).toBe(4)
  })

  it('keeps widths that exactly equal one screen pixel unchanged', () => {
    expect(resolveCanvasScreenMinimumStrokeWidth(4, 0.25)).toBe(4)
  })

  it('floors nonzero authored widths to one screen pixel when zoomed out', () => {
    expect(resolveCanvasScreenMinimumStrokeWidth(1, 0.25)).toBe(4)
  })

  it('preserves zero when zero represents a disabled state', () => {
    expect(resolveCanvasScreenMinimumStrokeWidth(0, 0.25, { allowZero: true })).toBe(0)
    expect(resolveCanvasScreenMinimumStrokeWidthCss(0, { allowZero: true })).toBe(0)
  })

  it('floors zero when the domain model does not allow zero-width strokes', () => {
    expect(resolveCanvasScreenMinimumStrokeWidth(0, 0.25)).toBe(4)
  })

  it('builds a viewport-zoom css floor for render-time stroke widths', () => {
    expect(resolveCanvasScreenMinimumStrokeWidthCss(2)).toBe(
      'max(2px, calc(1px / max(var(--canvas-zoom, 1), 0.0001)))',
    )
  })

  it('floors widths predictably at extremely small zoom values', () => {
    expect(resolveCanvasScreenMinimumStrokeWidth(1, 1e-6)).toBe(1_000_000)
  })
})
