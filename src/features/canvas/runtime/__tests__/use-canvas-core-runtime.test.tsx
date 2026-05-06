import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasCoreRuntime } from '../use-canvas-core-runtime'
import { testId } from '~/test/helpers/test-id'

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
    const { result, unmount } = renderHook(() =>
      useCanvasCoreRuntime({
        canvasId: testId<'sidebarItems'>('canvas-id'),
        initialViewport,
      }),
    )

    expect(result.current.canvasSurfaceRef.current).toBeNull()
    expect(result.current.viewportController.getViewport()).toEqual(initialViewport)
    expect(viewportPersistenceSpy).toHaveBeenCalledWith({
      canvasEngine: result.current.canvasEngine,
      canvasId: 'canvas-id',
      initialViewport,
    })

    unmount()
  })

  it('keeps stable core services across rerenders', () => {
    const { result, rerender, unmount } = renderHook(
      ({ zoom }) =>
        useCanvasCoreRuntime({
          canvasId: testId<'sidebarItems'>('canvas-id'),
          initialViewport: { x: 0, y: 0, zoom },
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
})
