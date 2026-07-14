import { testResourceId } from '../../../../../../shared/test/resource-id'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { useCanvasCoreRuntime } from '../use-canvas-core-runtime'
import { createMemoryCanvasViewportStore } from '../../../test/view-state-store-factory'

const viewportPersistenceSpy = vi.hoisted(() => vi.fn(() => vi.fn()))

vi.mock('../interaction/canvas-viewport-persistence', () => ({
  createCanvasViewportPersistence: viewportPersistenceSpy,
}))

describe('useCanvasCoreRuntime', () => {
  beforeEach(() => {
    viewportPersistenceSpy.mockClear()
  })

  it('creates the core canvas runtime and syncs the initial viewport', () => {
    const initialViewport = { x: 12, y: -8, zoom: 1.5 }
    const viewportStore = createMemoryCanvasViewportStore()
    const { result, unmount } = renderHook(() =>
      useCanvasCoreRuntime({
        canvasId: testResourceId('canvas-id'),
        initialViewport,
        viewportStore,
      }),
    )

    expect(result.current.canvasSurfaceRef.current).toBeNull()
    expect(result.current.viewportController.getViewport()).toEqual(initialViewport)
    expect(viewportPersistenceSpy).toHaveBeenCalledWith({
      canvasEngine: result.current.canvasEngine,
      canvasId: testResourceId('canvas-id'),
      initialViewport,
      viewportStore,
    })

    unmount()
  })

  it('keeps stable core services across rerenders', () => {
    const viewportStore = createMemoryCanvasViewportStore()
    const { result, rerender, unmount } = renderHook(
      ({ zoom }) =>
        useCanvasCoreRuntime({
          canvasId: testResourceId('canvas-id'),
          initialViewport: { x: 0, y: 0, zoom },
          viewportStore,
        }),
      { initialProps: { zoom: 1 } },
    )
    const firstRuntime = result.current

    rerender({ zoom: 2 })

    expect(result.current.canvasEngine).toBe(firstRuntime.canvasEngine)
    expect(result.current.domRuntime).toBe(firstRuntime.domRuntime)
    expect(result.current.viewportController).toBe(firstRuntime.viewportController)
    expect(result.current.viewportController.getViewport()).toEqual({ x: 0, y: 0, zoom: 2 })
    expect(viewportPersistenceSpy).toHaveBeenCalledTimes(1)

    unmount()
  })

  it('uses the current canvas viewport as the persistence baseline after canvas changes', () => {
    const viewportStore = createMemoryCanvasViewportStore()
    const { result, rerender, unmount } = renderHook(
      ({ canvasId, initialViewport }) =>
        useCanvasCoreRuntime({
          canvasId,
          initialViewport,
          viewportStore,
        }),
      {
        initialProps: {
          canvasId: testResourceId('canvas-1'),
          initialViewport: { x: 10, y: 20, zoom: 1.25 },
        },
      },
    )

    rerender({
      canvasId: testResourceId('canvas-2'),
      initialViewport: { x: -40, y: 80, zoom: 0.75 },
    })

    expect(viewportPersistenceSpy).toHaveBeenLastCalledWith({
      canvasEngine: result.current.canvasEngine,
      canvasId: testResourceId('canvas-2'),
      initialViewport: { x: -40, y: 80, zoom: 0.75 },
      viewportStore,
    })

    unmount()
  })
})
