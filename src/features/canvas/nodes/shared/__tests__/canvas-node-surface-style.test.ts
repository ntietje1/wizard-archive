import { describe, expect, it } from 'vitest'
import { normalizeCanvasNodeSurfaceStyleData } from '../canvas-node-surface-style'

describe('canvas-node-surface-style', () => {
  it('preserves a zero border width', () => {
    expect(normalizeCanvasNodeSurfaceStyleData({ borderWidth: 0 }).borderWidth).toBe(0)
  })

  it('clamps negative border widths to zero', () => {
    expect(normalizeCanvasNodeSurfaceStyleData({ borderWidth: -10 }).borderWidth).toBe(0)
  })

  it('preserves valid mid-range border widths', () => {
    expect(normalizeCanvasNodeSurfaceStyleData({ borderWidth: 50 }).borderWidth).toBe(50)
  })

  it('clamps oversized border widths to 99', () => {
    expect(normalizeCanvasNodeSurfaceStyleData({ borderWidth: 120 }).borderWidth).toBe(99)
  })

  it('uses the default numeric border width when absent', () => {
    expect(normalizeCanvasNodeSurfaceStyleData({}).borderWidth).toBeTypeOf('number')
    expect(normalizeCanvasNodeSurfaceStyleData(undefined).borderWidth).toBeTypeOf('number')
  })

  it('preserves non-integer border widths', () => {
    expect(normalizeCanvasNodeSurfaceStyleData({ borderWidth: 45.7 }).borderWidth).toBe(45.7)
  })

  it('normalizes background and border paint inputs', () => {
    expect(
      normalizeCanvasNodeSurfaceStyleData({
        backgroundColor: null,
        backgroundOpacity: 125,
        borderStroke: '',
        borderOpacity: -10,
      }),
    ).toEqual({
      backgroundColor: 'var(--background)',
      backgroundOpacity: 100,
      borderStroke: '',
      borderOpacity: 0,
      borderWidth: 1,
    })
  })
})
