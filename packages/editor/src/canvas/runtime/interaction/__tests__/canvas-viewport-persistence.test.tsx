import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createCanvasViewportPersistence } from '../canvas-viewport-persistence'
import { createCanvasEngine } from '../../../system/canvas-engine'
import { createMemoryCanvasViewportStore } from '../../../../test/view-state-store-factory'
import type { CanvasEngine } from '../../../system/canvas-engine-types'
import type { PersistedCanvasViewport } from '../canvas-viewport-storage'

describe('canvas viewport persistence', () => {
  let cleanup: (() => void) | null = null
  let engine: ReturnType<typeof createCanvasEngine> | null = null

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup?.()
    engine?.destroy()
    cleanup = null
    engine = null
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('loads saved viewports from the supplied store', () => {
    const store = createMemoryCanvasViewportStore(
      new Map([['canvas-1' as never, { x: 42, y: -18, zoom: 1.75 }]]),
    )

    expect(store.loadCanvasViewport('canvas-1' as never)).toEqual({
      x: 42,
      y: -18,
      zoom: 1.75,
    })
  })

  it('uses the default viewport for canvases without a saved viewport', () => {
    const store = createMemoryCanvasViewportStore()

    expect(store.loadCanvasViewport('canvas-1' as never)).toEqual({ x: 0, y: 0, zoom: 1 })
  })

  it('saves committed viewports to the supplied store', () => {
    const store = createMemoryCanvasViewportStore()

    store.saveCanvasViewport('canvas-1' as never, {
      x: 64,
      y: -32,
      zoom: 2,
    })

    expect(store.loadCanvasViewport('canvas-1' as never)).toEqual({ x: 64, y: -32, zoom: 2 })
  })

  it('persists viewport changes after a short debounce', () => {
    const store = createMemoryCanvasViewportStore()
    engine = createCanvasEngine()
    cleanup = createCanvasViewportPersistence({
      canvasEngine: engine,
      canvasId: 'canvas-1' as never,
      initialViewport: { x: 0, y: 0, zoom: 1 },
      viewportStore: store,
    })

    engine.setViewport({ x: 140, y: -80, zoom: 1.8 })

    expect(store.loadCanvasViewport('canvas-1' as never)).toEqual({ x: 0, y: 0, zoom: 1 })

    vi.advanceTimersByTime(250)

    expect(store.loadCanvasViewport('canvas-1' as never)).toEqual({ x: 140, y: -80, zoom: 1.8 })
  })

  it('flushes pending viewport changes on page lifecycle events', () => {
    const store = createMemoryCanvasViewportStore()
    engine = createCanvasEngine()
    cleanup = createCanvasViewportPersistence({
      canvasEngine: engine,
      canvasId: 'canvas-1' as never,
      initialViewport: { x: 0, y: 0, zoom: 1 },
      viewportStore: store,
    })

    engine.setViewport({ x: 140, y: -80, zoom: 1.8 })
    window.dispatchEvent(new Event('pagehide'))

    expect(store.loadCanvasViewport('canvas-1' as never)).toEqual({ x: 140, y: -80, zoom: 1.8 })

    vi.advanceTimersByTime(250)

    expect(store.loadCanvasViewport('canvas-1' as never)).toEqual({ x: 140, y: -80, zoom: 1.8 })
  })

  it('does not persist live viewport changes until they commit', () => {
    const store = createMemoryCanvasViewportStore()
    engine = createCanvasEngine()
    cleanup = createCanvasViewportPersistence({
      canvasEngine: engine,
      canvasId: 'canvas-1' as never,
      initialViewport: { x: 0, y: 0, zoom: 1 },
      viewportStore: store,
    })

    engine.setViewportLive({ x: 40, y: -20, zoom: 1.25 })
    vi.advanceTimersByTime(250)
    expect(store.loadCanvasViewport('canvas-1' as never)).toEqual({ x: 0, y: 0, zoom: 1 })

    engine.setViewport({ x: 40, y: -20, zoom: 1.25 })
    vi.advanceTimersByTime(250)
    expect(store.loadCanvasViewport('canvas-1' as never)).toEqual({ x: 40, y: -20, zoom: 1.25 })
  })

  it('removes the viewport listener and pending timeout when cleanup save fails', () => {
    const unsubscribe = vi.fn()
    const subscribeViewportCommit = vi.fn(
      (listener: (viewport: PersistedCanvasViewport) => void) => {
        void listener
        return unsubscribe
      },
    )
    const canvasEngine = {
      subscribeViewportCommit,
    } as unknown as CanvasEngine
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    const viewportStore = {
      loadCanvasViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
      saveCanvasViewport: vi.fn(() => {
        throw new Error('save failed')
      }),
    }
    const cleanupPersistence = createCanvasViewportPersistence({
      canvasEngine,
      canvasId: 'canvas-1' as never,
      initialViewport: { x: 0, y: 0, zoom: 1 },
      viewportStore,
    })

    const viewportListener = subscribeViewportCommit.mock.calls[0]?.[0]
    if (!viewportListener) {
      throw new Error('Expected viewport listener to be registered')
    }
    viewportListener({ x: 40, y: -20, zoom: 1.25 })

    expect(cleanupPersistence).toThrow('save failed')
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
  })

  it('removes the viewport listener and pending timeout after successful cleanup', () => {
    const unsubscribe = vi.fn()
    const subscribeViewportCommit = vi.fn(
      (listener: (viewport: PersistedCanvasViewport) => void) => {
        void listener
        return unsubscribe
      },
    )
    const canvasEngine = {
      subscribeViewportCommit,
    } as unknown as CanvasEngine
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    const viewportStore = {
      loadCanvasViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
      saveCanvasViewport: vi.fn(),
    }
    const cleanupPersistence = createCanvasViewportPersistence({
      canvasEngine,
      canvasId: 'canvas-1' as never,
      initialViewport: { x: 0, y: 0, zoom: 1 },
      viewportStore,
    })

    const viewportListener = subscribeViewportCommit.mock.calls[0]?.[0]
    if (!viewportListener) {
      throw new Error('Expected viewport listener to be registered')
    }
    viewportListener({ x: 40, y: -20, zoom: 1.25 })

    expect(cleanupPersistence).not.toThrow()
    expect(viewportStore.saveCanvasViewport).toHaveBeenCalledWith('canvas-1', {
      x: 40,
      y: -20,
      zoom: 1.25,
    })
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
  })
})
