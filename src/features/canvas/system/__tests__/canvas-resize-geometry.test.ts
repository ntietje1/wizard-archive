import { describe, expect, it } from 'vitest'
import { resolveCanvasResize } from '../canvas-resize-geometry'
import type { CanvasResizeGeometryOptions } from '../canvas-resize-geometry'

describe('resolveCanvasResize', () => {
  it('resolves all side handles without requiring DOM or engine state', () => {
    const startBounds = { x: 10, y: 20, width: 100, height: 50 }

    expect(
      resize({ handlePosition: 'top', currentPoint: { x: 60, y: 0 }, startBounds }).bounds,
    ).toEqual({ x: 10, y: 0, width: 100, height: 70 })
    expect(
      resize({ handlePosition: 'right', currentPoint: { x: 140, y: 45 }, startBounds }).bounds,
    ).toEqual({ x: 10, y: 20, width: 130, height: 50 })
    expect(
      resize({ handlePosition: 'bottom', currentPoint: { x: 60, y: 90 }, startBounds }).bounds,
    ).toEqual({ x: 10, y: 20, width: 100, height: 70 })
    expect(
      resize({ handlePosition: 'left', currentPoint: { x: -20, y: 45 }, startBounds }).bounds,
    ).toEqual({ x: -20, y: 20, width: 130, height: 50 })
  })

  it('enforces minimum dimensions for corner and side handles', () => {
    expect(
      resize({
        currentPoint: { x: 10, y: 10 },
        minWidth: 50,
        minHeight: 30,
      }).bounds,
    ).toEqual({ x: 0, y: 0, width: 50, height: 30 })
    expect(
      resize({
        handlePosition: 'right',
        startBounds: { x: 10, y: 20, width: 100, height: 50 },
        currentPoint: { x: 20, y: 70 },
        minWidth: 30,
        minHeight: 20,
      }).bounds,
    ).toEqual({ x: 10, y: 20, width: 30, height: 50 })
    expect(
      resize({
        handlePosition: 'top',
        startBounds: { x: 10, y: 20, width: 100, height: 50 },
        currentPoint: { x: 10, y: 60 },
        minWidth: 30,
        minHeight: 20,
      }).bounds,
    ).toEqual({ x: 10, y: 50, width: 100, height: 20 })
  })

  it('applies square constraints only to corner handles', () => {
    expect(
      resize({
        currentPoint: { x: 40, y: 80 },
        square: true,
      }).bounds,
    ).toEqual({ x: 0, y: 0, width: 40, height: 40 })
    expect(
      resize({
        handlePosition: 'left',
        startBounds: { x: 10, y: 20, width: 100, height: 50 },
        currentPoint: { x: -10, y: 1000 },
        square: true,
        minWidth: 30,
        minHeight: 20,
      }).bounds,
    ).toEqual({ x: -10, y: 20, width: 120, height: 50 })
  })

  it('preserves locked aspect ratio from corner and side handles', () => {
    expect(
      resize({
        currentPoint: { x: 100, y: 100 },
        lockedAspectRatio: 2,
      }).bounds,
    ).toEqual({ x: 0, y: 0, width: 100, height: 50 })
    expect(
      resize({
        handlePosition: 'right',
        startBounds: { x: 10, y: 20, width: 100, height: 50 },
        currentPoint: { x: 150, y: 1000 },
        lockedAspectRatio: 2,
        minWidth: 30,
        minHeight: 20,
      }).bounds,
    ).toEqual({ x: 10, y: 10, width: 140, height: 70 })
    expect(
      resize({
        handlePosition: 'bottom',
        startBounds: { x: 10, y: 20, width: 100, height: 50 },
        currentPoint: { x: -1000, y: 90 },
        lockedAspectRatio: 2,
        minWidth: 30,
        minHeight: 20,
      }).bounds,
    ).toEqual({ x: -10, y: 20, width: 140, height: 70 })
  })

  it('snaps resized bounds to nearby target bounds', () => {
    const result = resize({
      currentPoint: { x: 108, y: 43 },
      startBounds: { x: 0, y: 0, width: 100, height: 40 },
      targetBounds: [{ x: 110, y: 100, width: 20, height: 40 }],
      snap: true,
    })

    expect(result.bounds).toEqual({ x: 0, y: 0, width: 110, height: 43 })
    expect(result.guides).toContainEqual({
      orientation: 'vertical',
      position: 110,
      start: 0,
      end: 140,
    })
  })

  it('scales resize snapping thresholds by zoom', () => {
    const result = resize({
      currentPoint: { x: 107, y: 43 },
      startBounds: { x: 0, y: 0, width: 100, height: 40 },
      targetBounds: [{ x: 110, y: 100, width: 20, height: 40 }],
      snap: true,
      zoom: 2,
    })

    expect(result.bounds).toEqual({ x: 0, y: 0, width: 110, height: 43 })
    expect(result.guides).toContainEqual({
      orientation: 'vertical',
      position: 110,
      start: 0,
      end: 140,
    })
  })

  it('does not snap when the pointer is outside the scaled snap threshold', () => {
    const result = resize({
      currentPoint: { x: 104, y: 43 },
      startBounds: { x: 0, y: 0, width: 100, height: 40 },
      targetBounds: [{ x: 110, y: 100, width: 20, height: 40 }],
      snap: true,
      zoom: 2,
    })

    expect(result.bounds.width).toBe(104)
    expect(result.guides).toHaveLength(0)
  })

  it('chooses the closest overlapping resize snap target', () => {
    const result = resize({
      currentPoint: { x: 108, y: 43 },
      startBounds: { x: 0, y: 0, width: 100, height: 40 },
      targetBounds: [
        { x: 111, y: 100, width: 20, height: 40 },
        { x: 110, y: 120, width: 20, height: 40 },
      ],
      snap: true,
    })

    expect(result.bounds).toEqual({ x: 0, y: 0, width: 110, height: 43 })
    expect(result.guides).toContainEqual({
      orientation: 'vertical',
      position: 110,
      start: 0,
      end: 160,
    })
  })

  it('prefers locked aspect ratio when square resizing is also enabled', () => {
    expect(
      resize({
        currentPoint: { x: 100, y: 100 },
        lockedAspectRatio: 2,
        square: true,
      }).bounds,
    ).toEqual({ x: 0, y: 0, width: 100, height: 50 })
  })

  it('snaps side handle resizing on the active axis', () => {
    const result = resize({
      handlePosition: 'right',
      startBounds: { x: 0, y: 0, width: 100, height: 40 },
      currentPoint: { x: 108, y: 200 },
      targetBounds: [{ x: 110, y: 0, width: 20, height: 40 }],
      snap: true,
    })

    expect(result.bounds).toEqual({ x: 0, y: 0, width: 110, height: 40 })
    expect(result.guides).toContainEqual({
      orientation: 'vertical',
      position: 110,
      start: 0,
      end: 40,
    })
  })
})

function resize(overrides: Partial<CanvasResizeGeometryOptions> = {}) {
  return resolveCanvasResize({
    handlePosition: 'bottom-right',
    startBounds: { x: 0, y: 0, width: 100, height: 50 },
    currentPoint: { x: 100, y: 50 },
    targetBounds: [],
    minWidth: 10,
    minHeight: 10,
    square: false,
    snap: false,
    zoom: 1,
    ...overrides,
  })
}
