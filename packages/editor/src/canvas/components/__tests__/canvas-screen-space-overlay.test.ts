import { describe, expect, it } from 'vite-plus/test'
import {
  canvasBoundsToScreenBounds,
  canvasPointToScreenPoint,
  canvasPointsToScreenPoints,
  canvasStrokePointsToScreenPoints,
  normalizeScreenBounds,
} from '../canvas-screen-space-overlay-utils'

const viewport = { x: 5, y: -10, zoom: 2 }

describe('canvas screen-space overlay projection', () => {
  it('projects canvas points through viewport pan and zoom', () => {
    expect(canvasPointToScreenPoint({ x: 10, y: 20 }, viewport)).toEqual({ x: 25, y: 30 })
  })

  it('projects canvas bounds through viewport pan and zoom', () => {
    expect(canvasBoundsToScreenBounds({ x: 10, y: 20, width: 30, height: 40 }, viewport)).toEqual({
      x: 25,
      y: 30,
      width: 60,
      height: 80,
    })
  })

  it('normalizes inverted drag bounds after screen projection', () => {
    expect(
      normalizeScreenBounds(
        canvasBoundsToScreenBounds({ x: 10, y: 20, width: -30, height: -40 }, viewport),
      ),
    ).toEqual({
      x: -35,
      y: -50,
      width: 60,
      height: 80,
    })
  })

  it('projects point lists through viewport pan and zoom', () => {
    expect(
      canvasPointsToScreenPoints(
        [
          { x: 0, y: 0, id: 'start' },
          { x: 2, y: 4, id: 'end' },
        ],
        viewport,
      ),
    ).toEqual([
      { x: 5, y: -10, id: 'start' },
      { x: 9, y: -2, id: 'end' },
    ])
  })

  it('projects stroke point lists and preserves pressure values', () => {
    expect(
      canvasStrokePointsToScreenPoints(
        [
          [0, 0, 0.25],
          [2, 4, 0.75],
        ],
        viewport,
      ),
    ).toEqual([
      [5, -10, 0.25],
      [9, -2, 0.75],
    ])
  })
})
