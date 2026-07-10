import { describe, expect, it, vi } from 'vite-plus/test'
import { projectCanvasToolOverlayPoints, setPointerCapture } from '../tool-module-utils'

describe('tool module utils', () => {
  it('returns null when pointer capture throws', () => {
    const target = document.createElement('div')
    target.setPointerCapture = vi.fn(() => {
      throw new Error('capture unavailable')
    })

    expect(
      setPointerCapture({
        pointerId: 7,
        target,
      } as unknown as PointerEvent),
    ).toBeNull()
  })

  it('projects canvas overlay points into screen coordinates', () => {
    expect(
      projectCanvasToolOverlayPoints(
        [
          { x: 2, y: 4, pressure: 0.3 },
          { x: 6, y: 8, pressure: 0.7 },
        ],
        {
          x: 10,
          y: 20,
          zoom: 2,
        },
      ),
    ).toEqual([
      { x: 14, y: 28, pressure: 0.3 },
      { x: 22, y: 36, pressure: 0.7 },
    ])
  })

  it('does not project a single overlay point', () => {
    expect(projectCanvasToolOverlayPoints([{ x: 2, y: 4 }], { x: 10, y: 20, zoom: 2 })).toBeNull()
  })
})
