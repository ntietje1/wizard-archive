import { describe, expect, it } from 'vitest'
import {
  getCanvasNodeSurfaceStyle,
  normalizeCanvasNodeSurfaceStyleData,
} from '../canvas-node-surface-style'

describe('canvas-node-surface-style', () => {
  describe('normalizeCanvasNodeSurfaceStyleData', () => {
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
      expect(normalizeCanvasNodeSurfaceStyleData({}).borderWidth).toBe(1)
      expect(normalizeCanvasNodeSurfaceStyleData(undefined).borderWidth).toBe(1)
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
        textColor: 'var(--foreground)',
        backgroundColor: 'var(--background)',
        backgroundOpacity: 100,
        borderStroke: '',
        borderOpacity: 0,
        borderWidth: 1,
      })
    })

    it('normalizes empty text color to the default text color', () => {
      expect(normalizeCanvasNodeSurfaceStyleData({ textColor: '' }).textColor).toBe(
        'var(--foreground)',
      )
    })

    it('normalizes nullish text colors to the default text color', () => {
      expect(normalizeCanvasNodeSurfaceStyleData({ textColor: null }).textColor).toBe(
        'var(--foreground)',
      )
      expect(normalizeCanvasNodeSurfaceStyleData({ textColor: undefined }).textColor).toBe(
        'var(--foreground)',
      )
    })

    it('normalizes whitespace and invalid text colors to the default text color', () => {
      expect(normalizeCanvasNodeSurfaceStyleData({ textColor: '  ' }).textColor).toBe(
        'var(--foreground)',
      )
      expect(normalizeCanvasNodeSurfaceStyleData({ textColor: 'invalid-color' }).textColor).toBe(
        'var(--foreground)',
      )
    })
  })

  describe('getCanvasNodeSurfaceStyle', () => {
    it('renders zero-width borders as absent', () => {
      expect(getCanvasNodeSurfaceStyle({ borderWidth: 0 })).toMatchObject({
        border: 'none',
      })
    })

    it('renders nonzero borders with a screen-pixel css floor', () => {
      expect(
        getCanvasNodeSurfaceStyle({
          borderStroke: '#000000',
          borderOpacity: 100,
          borderWidth: 2,
        }),
      ).toMatchObject({
        borderColor: '#000000',
        borderStyle: 'solid',
        borderWidth: 'max(2px, calc(1px / max(var(--canvas-zoom, 1), 0.0001)))',
      })
    })
  })
})
