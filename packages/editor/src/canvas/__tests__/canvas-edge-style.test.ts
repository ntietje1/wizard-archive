import { describe, expect, it } from 'vite-plus/test'
import { resolveCanvasEdgeStyle } from '../canvas-edge-style'

describe('canvas edge style', () => {
  it('resolves the canonical persisted defaults', () => {
    expect(resolveCanvasEdgeStyle(undefined)).toEqual({
      stroke: 'var(--foreground)',
      strokeWidth: 1.5,
      opacity: 1,
    })
  })

  it('normalizes invalid render values without changing persisted content', () => {
    expect(
      resolveCanvasEdgeStyle({
        stroke: ' ',
        strokeWidth: -4,
        opacity: 2,
      }),
    ).toEqual({
      stroke: 'var(--foreground)',
      strokeWidth: 1,
      opacity: 1,
    })
  })
})
