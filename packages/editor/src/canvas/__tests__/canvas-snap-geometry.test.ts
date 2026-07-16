import { describe, expect, it } from 'vite-plus/test'
import { resolveCanvasDrag } from '../canvas-snap-geometry'

describe('canvas snap geometry', () => {
  it('snaps dragged edges and centers with a zoom-correct screen threshold', () => {
    expect(
      resolveCanvasDrag({
        delta: { x: 94, y: 46 },
        draggedBounds: [{ x: 0, y: 0, width: 100, height: 50 }],
        targetBounds: [{ x: 200, y: 100, width: 100, height: 50 }],
        constrain: false,
        snap: true,
        zoom: 2,
      }),
    ).toEqual({
      delta: { x: 94, y: 50 },
      guides: [{ orientation: 'horizontal', position: 100, start: 94, end: 300 }],
    })

    expect(
      resolveCanvasDrag({
        delta: { x: 96, y: 46 },
        draggedBounds: [{ x: 0, y: 0, width: 100, height: 50 }],
        targetBounds: [{ x: 200, y: 100, width: 100, height: 50 }],
        constrain: false,
        snap: true,
        zoom: 2,
      }).delta,
    ).toEqual({ x: 100, y: 50 })
  })

  it('uses Shift axis constraint without combining it with snapping', () => {
    expect(
      resolveCanvasDrag({
        delta: { x: 20, y: 5 },
        draggedBounds: [{ x: 0, y: 0, width: 100, height: 50 }],
        targetBounds: [{ x: 118, y: 0, width: 100, height: 50 }],
        constrain: true,
        snap: true,
        zoom: 1,
      }),
    ).toEqual({ delta: { x: 20, y: 0 }, guides: [] })
  })

  it('resolves adversarial target sets within one deterministic candidate budget', () => {
    const options = {
      delta: { x: 96, y: 46 },
      draggedBounds: [{ x: 0, y: 0, width: 100, height: 50 }],
      targetBounds: Array.from({ length: 20_000 }, (_, index) => ({
        x: 200 + index,
        y: 100 + index,
        width: 100,
        height: 50,
      })),
      constrain: false,
      snap: true,
      zoom: 2,
    }

    const first = resolveCanvasDrag(options)
    expect(resolveCanvasDrag(options)).toEqual(first)
    expect(first.delta).toEqual({ x: 100, y: 46 })
  })
})
