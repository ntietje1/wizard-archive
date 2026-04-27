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

  it('preserves locked aspect ratio from right handle', () => {
    const controller = createCanvasResizeController()
    controller.start({
      pointerId: 1,
      handlePosition: 'right',
      startBounds: { x: 10, y: 20, width: 100, height: 50 },
      targetBounds: [],
      minWidth: 30,
      minHeight: 20,
      lockedAspectRatio: 2,
    })

    const rightResult = controller.update({
      pointerId: 1,
      currentPoint: { x: 150, y: 1000 },
      square: false,
      snap: false,
      zoom: 1,
    })

    expect(rightResult?.bounds).toEqual({ x: 10, y: 10, width: 140, height: 70 })
  })

  it('preserves locked aspect ratio from left handle', () => {
    const controller = createCanvasResizeController()
    controller.start({
      pointerId: 1,
      handlePosition: 'left',
      startBounds: { x: 10, y: 20, width: 100, height: 50 },
      targetBounds: [],
      minWidth: 30,
      minHeight: 20,
      lockedAspectRatio: 2,
    })

    const leftResult = controller.update({
      pointerId: 1,
      currentPoint: { x: -20, y: -1000 },
      square: false,
      snap: false,
      zoom: 1,
    })

    expect(leftResult?.bounds).toEqual({ x: -20, y: 12.5, width: 130, height: 65 })
  })

  it('preserves locked aspect ratio from vertical side handles', () => {
    const controller = createCanvasResizeController()
    controller.start({
      pointerId: 1,
      handlePosition: 'bottom',
      startBounds: { x: 10, y: 20, width: 100, height: 50 },
      targetBounds: [],
      minWidth: 30,
      minHeight: 20,
      lockedAspectRatio: 2,
    })

    const bottomResult = controller.update({
      pointerId: 1,
      currentPoint: { x: -1000, y: 90 },
      square: false,
      snap: false,
      zoom: 1,
    })

    expect(bottomResult?.bounds).toEqual({ x: -10, y: 20, width: 140, height: 70 })

    controller.start({
      pointerId: 1,
      handlePosition: 'top',
      startBounds: { x: 10, y: 20, width: 100, height: 50 },
      targetBounds: [],
      minWidth: 30,
      minHeight: 20,
      lockedAspectRatio: 2,
    })

    const topResult = controller.update({
      pointerId: 1,
      currentPoint: { x: 1000, y: -10 },
      square: false,
      snap: false,
      zoom: 1,
    })

    expect(topResult?.bounds).toEqual({ x: -20, y: -10, width: 160, height: 80 })
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

  it('resizes width only from side handles', () => {
    const controller = createCanvasResizeController()
    controller.start({
      pointerId: 1,
      handlePosition: 'left',
      startBounds: { x: 10, y: 20, width: 100, height: 50 },
      targetBounds: [],
      minWidth: 30,
      minHeight: 20,
    })

    const leftResult = controller.update({
      pointerId: 1,
      currentPoint: { x: -10, y: 1000 },
      square: true,
      snap: false,
      zoom: 1,
    })

    expect(leftResult?.bounds).toEqual({ x: -10, y: 20, width: 120, height: 50 })

    controller.start({
      pointerId: 1,
      handlePosition: 'right',
      startBounds: { x: 10, y: 20, width: 100, height: 50 },
      targetBounds: [],
      minWidth: 30,
      minHeight: 20,
    })

    const rightResult = controller.update({
      pointerId: 1,
      currentPoint: { x: 150, y: -1000 },
      square: true,
      snap: false,
      zoom: 1,
    })

    expect(rightResult?.bounds).toEqual({ x: 10, y: 20, width: 140, height: 50 })
  })

  it('resizes height only from side handles', () => {
    const controller = createCanvasResizeController()
    controller.start({
      pointerId: 1,
      handlePosition: 'top',
      startBounds: { x: 10, y: 20, width: 100, height: 50 },
      targetBounds: [],
      minWidth: 30,
      minHeight: 20,
    })

    const topResult = controller.update({
      pointerId: 1,
      currentPoint: { x: 1000, y: -10 },
      square: true,
      snap: false,
      zoom: 1,
    })

    expect(topResult?.bounds).toEqual({ x: 10, y: -10, width: 100, height: 80 })

    controller.start({
      pointerId: 1,
      handlePosition: 'bottom',
      startBounds: { x: 10, y: 20, width: 100, height: 50 },
      targetBounds: [],
      minWidth: 30,
      minHeight: 20,
    })

    const bottomResult = controller.update({
      pointerId: 1,
      currentPoint: { x: -1000, y: 90 },
      square: true,
      snap: false,
      zoom: 1,
    })

    expect(bottomResult?.bounds).toEqual({ x: 10, y: 20, width: 100, height: 70 })
  })

  it('enforces minimum dimensions for side handles', () => {
    const controller = createCanvasResizeController()
    controller.start({
      pointerId: 1,
      handlePosition: 'right',
      startBounds: { x: 10, y: 20, width: 100, height: 50 },
      targetBounds: [],
      minWidth: 30,
      minHeight: 20,
    })

    const result = controller.update({
      pointerId: 1,
      currentPoint: { x: 20, y: 70 },
      square: false,
      snap: false,
      zoom: 1,
    })

    expect(result?.bounds).toEqual({ x: 10, y: 20, width: 30, height: 50 })
  })

  it('enforces minimum width for left handle', () => {
    const controller = createCanvasResizeController()
    controller.start({
      pointerId: 1,
      handlePosition: 'left',
      startBounds: { x: 10, y: 20, width: 100, height: 50 },
      targetBounds: [],
      minWidth: 30,
      minHeight: 20,
    })

    const result = controller.update({
      pointerId: 1,
      currentPoint: { x: 100, y: 70 },
      square: false,
      snap: false,
      zoom: 1,
    })

    expect(result?.bounds).toEqual({ x: 80, y: 20, width: 30, height: 50 })
  })

  it('enforces minimum height for top handle', () => {
    const controller = createCanvasResizeController()
    controller.start({
      pointerId: 1,
      handlePosition: 'top',
      startBounds: { x: 10, y: 20, width: 100, height: 50 },
      targetBounds: [],
      minWidth: 30,
      minHeight: 20,
    })

    const result = controller.update({
      pointerId: 1,
      currentPoint: { x: 10, y: 60 },
      square: false,
      snap: false,
      zoom: 1,
    })

    expect(result?.bounds).toEqual({ x: 10, y: 50, width: 100, height: 20 })
  })

  it('enforces minimum height for bottom handle', () => {
    const controller = createCanvasResizeController()
    controller.start({
      pointerId: 1,
      handlePosition: 'bottom',
      startBounds: { x: 10, y: 20, width: 100, height: 50 },
      targetBounds: [],
      minWidth: 30,
      minHeight: 20,
    })

    const result = controller.update({
      pointerId: 1,
      currentPoint: { x: 10, y: 30 },
      square: false,
      snap: false,
      zoom: 1,
    })

    expect(result?.bounds).toEqual({ x: 10, y: 20, width: 100, height: 20 })
  })

  it('snaps side handle resizing on the active axis', () => {
    const controller = createCanvasResizeController()
    controller.start({
      pointerId: 1,
      handlePosition: 'right',
      startBounds: { x: 0, y: 0, width: 100, height: 40 },
      targetBounds: [{ x: 110, y: 0, width: 20, height: 40 }],
      minWidth: 10,
      minHeight: 10,
    })

    const result = controller.update({
      pointerId: 1,
      currentPoint: { x: 108, y: 200 },
      square: false,
      snap: true,
      zoom: 1,
    })

    expect(result?.bounds).toEqual({ x: 0, y: 0, width: 110, height: 40 })
    expect(result?.guides).toContainEqual({
      orientation: 'vertical',
      position: 110,
      start: 0,
      end: 40,
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
