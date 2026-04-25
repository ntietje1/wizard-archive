import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCanvasEngine } from '../canvas-engine'
import { createCanvasViewportController } from '../canvas-viewport-controller'

const VIEWPORT_COMMIT_IDLE_MS = 300

describe('createCanvasViewportController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('handles wheel pan as a live viewport update and commits through the narrow viewport channel', () => {
    const { controller, engine, listener, viewportListener, viewportElement } =
      createViewportTestHarness()

    controller.handleWheel(
      new WheelEvent('wheel', {
        deltaX: 10,
        deltaY: 20,
        cancelable: true,
      }),
    )
    engine.flushRenderScheduler()

    expect(listener).not.toHaveBeenCalled()
    expect(viewportListener).not.toHaveBeenCalled()
    expect(engine.getSnapshot().viewport).toEqual({ x: -10, y: -20, zoom: 1 })
    expect(viewportElement.style.transform).toBe('translate3d(-10px, -20px, 0) scale(1)')

    vi.advanceTimersByTime(VIEWPORT_COMMIT_IDLE_MS)

    expect(listener).not.toHaveBeenCalled()
    expect(viewportListener).toHaveBeenCalledTimes(1)
    expect(viewportListener).toHaveBeenCalledWith({ x: -10, y: -20, zoom: 1 })

    controller.destroy()
    engine.destroy()
  })

  it('keeps repeated ctrl-wheel zoom off the general render subscription until idle commit', () => {
    const { controller, engine, listener, viewportListener, viewportElement } =
      createViewportTestHarness()

    controller.handleWheel(
      new WheelEvent('wheel', {
        clientX: 400,
        clientY: 300,
        ctrlKey: true,
        deltaY: -100,
        cancelable: true,
      }),
    )
    const firstViewport = engine.getSnapshot().viewport
    controller.handleWheel(
      new WheelEvent('wheel', {
        clientX: 400,
        clientY: 300,
        ctrlKey: true,
        deltaY: -100,
        cancelable: true,
      }),
    )
    engine.flushRenderScheduler()

    expect(listener).not.toHaveBeenCalled()
    expect(viewportListener).not.toHaveBeenCalled()
    expect(engine.getSnapshot().viewport.zoom).toBeGreaterThan(firstViewport.zoom)
    expect(viewportElement.style.transform).toContain('scale(')

    vi.advanceTimersByTime(VIEWPORT_COMMIT_IDLE_MS)

    expect(listener).not.toHaveBeenCalled()
    expect(viewportListener).toHaveBeenCalledTimes(1)
    expect(viewportListener).toHaveBeenCalledWith(engine.getSnapshot().viewport)

    controller.destroy()
    engine.destroy()
  })

  it('zooms around the pointer without coordinate drift', () => {
    const engine = createCanvasEngine()
    const surface = createSurface({ left: 100, top: 50 })
    const controller = createCanvasViewportController({
      canvasEngine: engine,
      getSurfaceElement: () => surface,
    })
    const before = controller.screenToCanvasPosition({ x: 300, y: 250 })

    controller.zoomTo(2, { x: 300, y: 250 })

    expect(controller.screenToCanvasPosition({ x: 300, y: 250 })).toEqual(before)

    controller.destroy()
    engine.destroy()
  })

  it('uses bounded exponential scaling for ctrl-wheel zoom', () => {
    const { controller, engine } = createViewportTestHarness()

    controller.handleWheel(
      new WheelEvent('wheel', {
        clientX: 400,
        clientY: 300,
        ctrlKey: true,
        deltaY: 500,
        cancelable: true,
      }),
    )
    const zoomAfterLargeZoomOut = engine.getSnapshot().viewport.zoom
    controller.handleWheel(
      new WheelEvent('wheel', {
        clientX: 400,
        clientY: 300,
        ctrlKey: true,
        deltaY: -500,
        cancelable: true,
      }),
    )

    expect(zoomAfterLargeZoomOut).toBe(0.5)
    expect(engine.getSnapshot().viewport.zoom).toBe(1)

    controller.destroy()
    engine.destroy()
  })

  it('keeps ctrl-wheel zoom engine-owned inside nowheel node content', () => {
    const { controller, engine } = createViewportTestHarness()
    const nowheelTarget = document.createElement('div')
    nowheelTarget.className = 'nowheel'
    const event = createWheelEvent({
      target: nowheelTarget,
      clientX: 400,
      clientY: 300,
      ctrlKey: true,
      deltaY: -500,
    })

    controller.handleWheel(event)

    expect(event.defaultPrevented).toBe(true)
    expect(engine.getSnapshot().viewport.zoom).toBe(2)

    controller.destroy()
    engine.destroy()
  })

  it('pans through an engine-owned pointer gesture and commits once on release', () => {
    const { controller, engine, listener, viewportListener, surface, viewportElement } =
      createViewportTestHarness()
    const releasePointerCapture = vi.fn()
    surface.setPointerCapture = vi.fn()
    surface.hasPointerCapture = vi.fn(() => true)
    surface.releasePointerCapture = releasePointerCapture

    controller.handlePanPointerDown(
      createPointerEvent('pointerdown', {
        clientX: 100,
        clientY: 200,
        currentTarget: surface,
        pointerId: 7,
        target: surface,
      }),
    )
    window.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 130, clientY: 180, pointerId: 7 }),
    )
    engine.flushRenderScheduler()

    expect(listener).not.toHaveBeenCalled()
    expect(viewportListener).not.toHaveBeenCalled()
    expect(engine.getSnapshot().viewport).toEqual({ x: 30, y: -20, zoom: 1 })
    expect(viewportElement.style.transform).toBe('translate3d(30px, -20px, 0) scale(1)')

    window.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 130, clientY: 180, pointerId: 7 }),
    )

    expect(listener).not.toHaveBeenCalled()
    expect(viewportListener).toHaveBeenCalledTimes(1)
    expect(viewportListener).toHaveBeenCalledWith({ x: 30, y: -20, zoom: 1 })
    expect(releasePointerCapture).toHaveBeenCalledWith(7)

    controller.destroy()
    engine.destroy()
  })
})

function createViewportTestHarness() {
  const engine = createCanvasEngine()
  const surface = createSurface()
  const viewportElement = document.createElement('div')
  engine.registerViewportElement(viewportElement)
  const listener = vi.fn()
  const viewportListener = vi.fn()
  engine.subscribe(listener)
  engine.subscribeViewportCommit(viewportListener)
  const controller = createCanvasViewportController({
    canvasEngine: engine,
    getSurfaceElement: () => surface,
  })

  return { controller, engine, listener, viewportListener, surface, viewportElement }
}

function createSurface({ left = 0, top = 0 } = {}) {
  const surface = document.createElement('div')
  surface.getBoundingClientRect = () =>
    ({
      x: left,
      y: top,
      left,
      top,
      right: left + 800,
      bottom: top + 600,
      width: 800,
      height: 600,
    }) as DOMRect
  return surface
}

function createPointerEvent(
  type: string,
  init: {
    clientX: number
    clientY: number
    pointerId: number
    currentTarget?: EventTarget
    target?: EventTarget
  },
): PointerEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent
  Object.defineProperties(event, {
    clientX: { value: init.clientX },
    clientY: { value: init.clientY },
    pointerId: { value: init.pointerId },
    currentTarget: { value: init.currentTarget ?? null },
    target: { value: init.target ?? null },
  })
  return event
}

function createWheelEvent({
  target,
  clientX,
  clientY,
  ctrlKey,
  deltaY,
}: {
  target: EventTarget
  clientX: number
  clientY: number
  ctrlKey: boolean
  deltaY: number
}): WheelEvent {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    ctrlKey,
    deltaY,
  })
  Object.defineProperty(event, 'target', { value: target })
  return event
}
