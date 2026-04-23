import { describe, expect, it } from 'vitest'
import { readCanvasNodeBorderWidth } from '../canvas-node-surface-style'

describe('canvas-node-surface-style', () => {
  it('preserves a zero border width', () => {
    expect(readCanvasNodeBorderWidth(0)).toBe(0)
  })

  it('clamps oversized border widths to 99', () => {
    expect(readCanvasNodeBorderWidth(120)).toBe(99)
  })
})
