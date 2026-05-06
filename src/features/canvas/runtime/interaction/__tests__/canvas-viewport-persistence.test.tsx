import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCanvasViewportPersistence } from '../canvas-viewport-persistence'
import { createCanvasEngine } from '../../../system/canvas-engine'
import {
  loadPersistedCanvasViewport,
  savePersistedCanvasViewport,
} from '../canvas-viewport-storage'

describe('canvas viewport persistence', () => {
  let storage: Record<string, string>
  let cleanup: (() => void) | null = null
  let engine: ReturnType<typeof createCanvasEngine> | null = null

  beforeEach(() => {
    storage = {}
    vi.useFakeTimers()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => storage[key] ?? null)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      storage[key] = value
    })
    vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true)
  })

  afterEach(() => {
    cleanup?.()
    engine?.destroy()
    cleanup = null
    engine = null
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('loads a saved viewport for the canvas when present', () => {
    storage['canvas-viewport-canvas-1'] = JSON.stringify({ x: 42, y: -18, zoom: 1.75 })

    expect(loadPersistedCanvasViewport('canvas-1' as never)).toEqual({
      x: 42,
      y: -18,
      zoom: 1.75,
    })
  })

  it('falls back to the default viewport when storage is invalid', () => {
    storage['canvas-viewport-canvas-1'] = '{"x":"bad"}'

    expect(loadPersistedCanvasViewport('canvas-1' as never)).toEqual({
      x: 0,
      y: 0,
      zoom: 1,
    })
  })

  it('saves the viewport and dispatches a localStorageChange event', async () => {
    savePersistedCanvasViewport('canvas-1' as never, {
      x: 64,
      y: -32,
      zoom: 2,
    })

    await Promise.resolve()

    expect(storage['canvas-viewport-canvas-1']).toBe(JSON.stringify({ x: 64, y: -32, zoom: 2 }))
    expect(window.dispatchEvent).toHaveBeenCalledOnce()
    const event = vi.mocked(window.dispatchEvent).mock.calls[0][0] as CustomEvent
    expect(event.type).toBe('localStorageChange')
    expect(event.detail.key).toBe('canvas-viewport-canvas-1')
  })

  it('persists viewport changes after a short debounce', () => {
    engine = createCanvasEngine()
    cleanup = createCanvasViewportPersistence({
      canvasEngine: engine,
      canvasId: 'canvas-1' as never,
      initialViewport: { x: 0, y: 0, zoom: 1 },
    })

    engine.setViewport({ x: 140, y: -80, zoom: 1.8 })

    expect(storage['canvas-viewport-canvas-1']).toBeUndefined()

    vi.advanceTimersByTime(250)

    expect(storage['canvas-viewport-canvas-1']).toBe(JSON.stringify({ x: 140, y: -80, zoom: 1.8 }))
  })

  it('does not persist live viewport changes until they commit', () => {
    engine = createCanvasEngine()
    cleanup = createCanvasViewportPersistence({
      canvasEngine: engine,
      canvasId: 'canvas-1' as never,
      initialViewport: { x: 0, y: 0, zoom: 1 },
    })

    engine.setViewportLive({ x: 40, y: -20, zoom: 1.25 })
    vi.advanceTimersByTime(250)
    expect(storage['canvas-viewport-canvas-1']).toBeUndefined()

    engine.setViewport({ x: 40, y: -20, zoom: 1.25 })
    vi.advanceTimersByTime(250)
    expect(storage['canvas-viewport-canvas-1']).toBe(JSON.stringify({ x: 40, y: -20, zoom: 1.25 }))
  })
})
