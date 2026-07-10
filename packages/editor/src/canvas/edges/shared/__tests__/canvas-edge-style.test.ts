import { describe, expect, it } from 'vite-plus/test'
import { resolveCanvasScreenMinimumStrokeWidthCss } from '../../../screen-stroke-width'
import {
  buildCanvasEdgeRenderStyle,
  clampCanvasEdgeStrokeWidth,
  normalizeCanvasEdgeStroke,
  normalizeCanvasEdgeStyle,
  readCanvasEdgeOpacityPercent,
} from '../canvas-edge-style'
import type { CSSProperties } from 'react'

describe('canvas edge style helpers', () => {
  it('normalizes empty and invalid strokes to the default edge stroke', () => {
    expect(normalizeCanvasEdgeStroke('var(--t-red)')).toBe('var(--t-red)')
    expect(normalizeCanvasEdgeStroke('   ')).toBe('var(--foreground)')
    expect(normalizeCanvasEdgeStroke(null)).toBe('var(--foreground)')
  })

  it('clamps finite stroke widths and defaults non-finite values', () => {
    expect(clampCanvasEdgeStrokeWidth(0)).toBe(1)
    expect(clampCanvasEdgeStrokeWidth(3)).toBe(3)
    expect(clampCanvasEdgeStrokeWidth(Number.NaN)).toBe(1.5)
  })

  it('normalizes style fallbacks for stroke, width, and opacity', () => {
    expect(
      normalizeCanvasEdgeStyle({
        stroke: '',
        strokeWidth: Number.POSITIVE_INFINITY,
        opacity: Number.NaN,
      } as CSSProperties),
    ).toEqual({
      stroke: 'var(--foreground)',
      strokeWidth: 1.5,
      opacity: 1,
    })
  })

  it('clamps and rounds opacity percent reads', () => {
    expect(readCanvasEdgeOpacityPercent({ opacity: 0.456 })).toBe(46)
    expect(readCanvasEdgeOpacityPercent({ opacity: 2 })).toBe(100)
    expect(readCanvasEdgeOpacityPercent({ opacity: -1 })).toBe(0)
  })

  it('builds render styles from normalized edge style values', () => {
    expect(
      buildCanvasEdgeRenderStyle({
        stroke: 'var(--t-blue)',
        strokeWidth: 3,
        opacity: 0.5,
      }),
    ).toEqual({
      stroke: 'var(--t-blue)',
      strokeWidth: resolveCanvasScreenMinimumStrokeWidthCss(3),
      opacity: 0.5,
    })
  })
})
