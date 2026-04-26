import { describe, expect, it } from 'vitest'
import { createCanvasResizeController } from '../canvas-resize-controller'

describe('createCanvasResizeController', () => {
  it('enforces minimum dimensions during live resize', () => {
    const controller = createCanvasResizeController()
    controller.start({
      pointerId: 1,
      handlePosition: 'bottom-right',
      startBounds: { x: 0, y: 0, width: 100, height: 50 },
      targetBounds: [],
      minWidth: 50,
      minHeight: 30,
    })

    const result = controller.update({
      pointerId: 1,
      currentPoint: { x: 10, y: 10 },
      square: false,
      snap: false,
      zoom: 1,
    })

    expect(result).toEqual({
      bounds: { x: 0, y: 0, width: 50, height: 30 },
      guides: [],
      final: false,
    })
  })

  it('resizes to a square while constrained', () => {
    const controller = createCanvasResizeController()
    controller.start({
      pointerId: 1,
      handlePosition: 'bottom-right',
      startBounds: { x: 0, y: 0, width: 100, height: 50 },
      targetBounds: [],
      minWidth: 10,
      minHeight: 10,
    })

    const result = controller.update({
      pointerId: 1,
      currentPoint: { x: 40, y: 80 },
      square: true,
      snap: false,
      zoom: 1,
    })

    expect(result?.bounds).toEqual({ x: 0, y: 0, width: 40, height: 40 })
  })

  it('preserves locked aspect ratio', () => {
    const controller = createCanvasResizeController()
    controller.start({
      pointerId: 1,
      handlePosition: 'bottom-right',
      startBounds: { x: 0, y: 0, width: 100, height: 50 },
      targetBounds: [],
      minWidth: 10,
      minHeight: 10,
      lockedAspectRatio: 2,
    })

    const result = controller.update({
      pointerId: 1,
      currentPoint: { x: 100, y: 100 },
      square: false,
      snap: false,
      zoom: 1,
    })

    expect(result?.bounds).toEqual({ x: 0, y: 0, width: 100, height: 50 })
  })

  it('snaps resized bounds to nearby target bounds', () => {
    const controller = createCanvasResizeController()
    controller.start({
      pointerId: 1,
      handlePosition: 'bottom-right',
      startBounds: { x: 0, y: 0, width: 100, height: 40 },
      targetBounds: [{ x: 110, y: 0, width: 20, height: 40 }],
      minWidth: 10,
      minHeight: 10,
    })

    const result = controller.update({
      pointerId: 1,
      currentPoint: { x: 108, y: 43 },
      square: false,
      snap: true,
      zoom: 1,
    })

    expect(result?.bounds.width).toBe(110)
    expect(result?.guides).toContainEqual({
      orientation: 'vertical',
      position: 110,
      start: 0,
      end: 43,
    })
  })

  it('refreshes modifier state against the last pointer point', () => {
    const controller = createCanvasResizeController()
    controller.start({
      pointerId: 1,
      handlePosition: 'bottom-right',
      startBounds: { x: 0, y: 0, width: 100, height: 50 },
      targetBounds: [],
      minWidth: 10,
      minHeight: 10,
    })

    controller.update({
      pointerId: 1,
      currentPoint: { x: 100, y: 45 },
      square: false,
      snap: false,
      zoom: 1,
    })

    const result = controller.refreshModifiers({ square: true, snap: false, zoom: 1 })
    expect(result?.bounds).toEqual({ x: 0, y: 0, width: 45, height: 45 })
  })

  it('commits once and clears the active session', () => {
    const controller = createCanvasResizeController()
    controller.start({
      pointerId: 1,
      handlePosition: 'bottom-right',
      startBounds: { x: 0, y: 0, width: 100, height: 50 },
      targetBounds: [],
      minWidth: 10,
      minHeight: 10,
    })

    const commitResult = controller.commit({
      pointerId: 1,
      currentPoint: { x: 120, y: 60 },
      square: false,
      snap: false,
      zoom: 1,
    })
    const updateAfterCommit = controller.update({
      pointerId: 1,
      currentPoint: { x: 130, y: 70 },
      square: false,
      snap: false,
      zoom: 1,
    })

    expect(commitResult).toEqual({
      bounds: { x: 0, y: 0, width: 120, height: 60 },
      guides: [],
      final: true,
    })
    expect(updateAfterCommit).toBeNull()
  })

  it('cancels without returning a final update', () => {
    const controller = createCanvasResizeController()
    controller.start({
      pointerId: 1,
      handlePosition: 'bottom-right',
      startBounds: { x: 0, y: 0, width: 100, height: 50 },
      targetBounds: [],
      minWidth: 10,
      minHeight: 10,
    })

    controller.cancel()

    expect(
      controller.update({
        pointerId: 1,
        currentPoint: { x: 120, y: 60 },
        square: false,
        snap: false,
        zoom: 1,
      }),
    ).toBeNull()
  })
})
