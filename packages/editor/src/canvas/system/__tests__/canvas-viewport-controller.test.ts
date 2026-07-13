import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createCanvasDomRuntime } from '../canvas-dom-runtime'
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
    const { controller, domRuntime, engine, listener, viewportListener, viewportElement } =
      createViewportTestHarness()

    controller.handleWheel(
      new WheelEvent('wheel', {
        deltaX: 10,
        deltaY: 20,
        cancelable: true,
      }),
    )
    domRuntime.flush()

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

  it('clears a pending wheel commit when explicitly committed', () => {
    const { controller, domRuntime, engine, listener, viewportListener } =
      createViewportTestHarness()

    controller.handleWheel(
      new WheelEvent('wheel', {
        deltaX: 10,
        deltaY: 20,
        cancelable: true,
      }),
    )
    domRuntime.flush()

    controller.commit()
    vi.advanceTimersByTime(VIEWPORT_COMMIT_IDLE_MS)

    expect(listener).not.toHaveBeenCalled()
    expect(viewportListener).toHaveBeenCalledTimes(1)
    expect(viewportListener).toHaveBeenCalledWith({ x: -10, y: -20, zoom: 1 })

    controller.destroy()
    engine.destroy()
  })

  it('defers a pending wheel commit until an engine-owned pan ends', () => {
    const { controller, engine, viewportListener, surface } = createViewportTestHarness()
    surface.setPointerCapture = vi.fn()
    surface.hasPointerCapture = vi.fn(() => true)
    surface.releasePointerCapture = vi.fn()

    controller.handleWheel(new WheelEvent('wheel', { deltaX: 10, cancelable: true }))
    controller.handlePanPointerDown(
      createPointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100,
        currentTarget: surface,
        target: surface,
        pointerId: 7,
      }),
    )
    vi.advanceTimersByTime(VIEWPORT_COMMIT_IDLE_MS)

    expect(viewportListener).not.toHaveBeenCalled()

    window.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 100, clientY: 100, pointerId: 7 }),
    )

    expect(viewportListener).toHaveBeenCalledOnce()
    expect(viewportListener).toHaveBeenCalledWith(engine.getSnapshot().viewport)

    controller.destroy()
    engine.destroy()
  })

  it('commits an in-flight wheel viewport before destroy clears its idle timer', () => {
    const { controller, domRuntime, engine, listener, viewportListener } =
      createViewportTestHarness()

    controller.handleWheel(
      new WheelEvent('wheel', {
        deltaX: 10,
        deltaY: 20,
        cancelable: true,
      }),
    )
    domRuntime.flush()

    controller.destroy()
    vi.advanceTimersByTime(VIEWPORT_COMMIT_IDLE_MS)

    expect(listener).not.toHaveBeenCalled()
    expect(engine.getSnapshot().viewport).toEqual({ x: -10, y: -20, zoom: 1 })
    expect(viewportListener).toHaveBeenCalledTimes(1)
    expect(viewportListener).toHaveBeenCalledWith({ x: -10, y: -20, zoom: 1 })

    engine.destroy()
  })

  it('keeps repeated ctrl-wheel zoom off the general render subscription until idle commit', () => {
    const { controller, domRuntime, engine, listener, viewportListener, viewportElement } =
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
    domRuntime.flush()

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
    const domRuntime = createCanvasDomRuntime()
    const engine = createCanvasEngine({ domRuntime })
    const surface = createSurface({ left: 100, top: 50 })
    const controller = createCanvasViewportController({
      canvasEngine: engine,
      domRuntime,
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

  it('updates zoom bounds after creation', () => {
    const { controller, engine } = createViewportTestHarness()

    controller.setZoomBounds({ maxZoom: 1.5, minZoom: 0.25 })
    controller.zoomTo(4)

    expect(engine.getSnapshot().viewport.zoom).toBe(1.5)

    controller.zoomTo(0.01)

    expect(engine.getSnapshot().viewport.zoom).toBe(0.25)

    controller.destroy()
    engine.destroy()
  })

  it('ignores non-finite zoom bound updates', () => {
    const { controller, engine } = createViewportTestHarness()

    controller.setZoomBounds({ maxZoom: 1.5, minZoom: 0.25 })
    controller.setZoomBounds({ maxZoom: Number.POSITIVE_INFINITY, minZoom: Number.NaN })
    controller.zoomTo(4)

    expect(engine.getSnapshot().viewport.zoom).toBe(1.5)

    controller.zoomTo(0.01)

    expect(engine.getSnapshot().viewport.zoom).toBe(0.25)

    controller.destroy()
    engine.destroy()
  })

  it('ignores every wheel event inside nowheel node content', () => {
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

    expect(event.defaultPrevented).toBe(false)
    expect(engine.getSnapshot().viewport.zoom).toBe(1)

    controller.destroy()
    engine.destroy()
  })

  it('ignores zero and negative zoom bounds', () => {
    const { controller, engine } = createViewportTestHarness()

    controller.setZoomBounds({ maxZoom: -1, minZoom: 0 })
    controller.zoomTo(4)

    expect(engine.getSnapshot().viewport.zoom).toBe(4)

    controller.destroy()
    engine.destroy()
  })

  it('reclamps the active viewport when zoom bounds shrink', () => {
    const { controller, engine } = createViewportTestHarness()

    controller.zoomTo(3, undefined, { commit: true })
    controller.setZoomBounds({ maxZoom: 1.5, minZoom: 0.25 })

    expect(engine.getSnapshot().viewport.zoom).toBe(1.5)

    controller.destroy()
    engine.destroy()
  })

  it('pans through an engine-owned pointer gesture and commits once on release', () => {
    const { controller, domRuntime, engine, listener, viewportListener, surface, viewportElement } =
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
    domRuntime.flush()

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

  it('cleans up pointer pan state when capture is lost', () => {
    const { controller, domRuntime, engine, listener, viewportListener, surface } =
      createViewportTestHarness()
    surface.setPointerCapture = vi.fn()
    surface.hasPointerCapture = vi.fn(() => false)
    surface.releasePointerCapture = vi.fn()

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
    surface.dispatchEvent(
      createPointerEvent('lostpointercapture', { clientX: 130, clientY: 180, pointerId: 7 }),
    )
    domRuntime.flush()

    expect(listener).not.toHaveBeenCalled()
    expect(viewportListener).toHaveBeenCalledTimes(1)
    expect(viewportListener).toHaveBeenCalledWith({ x: 30, y: -20, zoom: 1 })

    controller.handlePanPointerDown(
      createPointerEvent('pointerdown', {
        clientX: 130,
        clientY: 180,
        currentTarget: surface,
        pointerId: 8,
        target: surface,
      }),
    )
    window.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 150, clientY: 210, pointerId: 8 }),
    )
    domRuntime.flush()

    expect(engine.getSnapshot().viewport).toEqual({ x: 50, y: 10, zoom: 1 })

    controller.destroy()
    engine.destroy()
  })
})

function createViewportTestHarness() {
  const domRuntime = createCanvasDomRuntime()
  const engine = createCanvasEngine({ domRuntime })
  const surface = createSurface()
  const viewportElement = document.createElement('div')
  domRuntime.registerViewportElement(viewportElement)
  const listener = vi.fn()
  const viewportListener = vi.fn()
  engine.subscribe(listener)
  engine.subscribeViewportCommit(viewportListener)
  const controller = createCanvasViewportController({
    canvasEngine: engine,
    domRuntime,
    getSurfaceElement: () => surface,
  })

  return { controller, domRuntime, engine, listener, viewportListener, surface, viewportElement }
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
