import { describe, expect, it } from 'vite-plus/test'
import {
  canvasTextPlacementDragBounds,
  resolveCanvasTextPlacementBounds,
} from '../canvas-node-placement'

describe('canvas text placement', () => {
  it('centers the reference default size on a click', () => {
    expect(resolveCanvasTextPlacementBounds({ x: 100, y: 200 }, { x: 100, y: 200 }, false)).toEqual(
      {
        x: -60,
        y: 80,
        width: 320,
        height: 240,
      },
    )
  })

  it('uses the authored rectangle for a drag in either direction', () => {
    expect(resolveCanvasTextPlacementBounds({ x: 100, y: 200 }, { x: 180, y: 260 }, false)).toEqual(
      {
        x: 100,
        y: 200,
        width: 80,
        height: 60,
      },
    )
    expect(resolveCanvasTextPlacementBounds({ x: 180, y: 260 }, { x: 100, y: 200 }, false)).toEqual(
      {
        x: 100,
        y: 200,
        width: 80,
        height: 60,
      },
    )
  })

  it('projects a square drag without changing its origin quadrant', () => {
    expect(canvasTextPlacementDragBounds({ x: 100, y: 200 }, { x: 40, y: 230 }, true)).toEqual({
      x: 70,
      y: 200,
      width: 30,
      height: 30,
    })
  })
})
