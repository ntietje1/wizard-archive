import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearCanvasPendingSelectionPreview,
  useCanvasPendingSelectionPreviewStore,
} from '../use-canvas-pending-selection-preview'
import { useCanvasSelectionRect } from '../use-canvas-selection-rect'
import { clearSelectToolLocalOverlay } from '../../../tools/select/select-tool-local-overlay'

const reactFlowMock = vi.hoisted(() => ({
  screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
  getZoom: () => 1,
}))

const storeState = vi.hoisted(() => ({
  nodeLookup: new Map(),
}))

const storeApiMock = vi.hoisted(() => {
  return {
    getState: () => storeState,
    reset: () => {
      storeState.nodeLookup = new Map()
    },
  }
})

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => reactFlowMock,
  useStoreApi: () => storeApiMock,
}))

describe('useCanvasSelectionRect', () => {
  const rafCallbacks = new Map<number, FrameRequestCallback>()
  let nextRafId = 1

  beforeEach(() => {
    clearSelectToolLocalOverlay()
    clearCanvasPendingSelectionPreview()
    storeApiMock.reset()
    rafCallbacks.clear()
    nextRafId = 1
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        const rafId = nextRafId
        nextRafId += 1
        rafCallbacks.set(rafId, callback)
        return rafId
      }),
    )
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((rafId: number) => {
        rafCallbacks.delete(rafId)
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function flushAnimationFrame() {
    const callbacks = Array.from(rafCallbacks.entries())
    rafCallbacks.clear()

    for (const [, callback] of callbacks) {
      callback(performance.now())
    }
  }

  it('coalesces marquee preview updates to one animation frame and still commits the latest rectangle', () => {
    const setPresence = vi.fn()
    const suppressNextSurfaceClick = vi.fn()
    const selection = {
      beginGesture: vi.fn(),
      commitGestureSelection: vi.fn(),
      endGesture: vi.fn(),
    }
    storeState.nodeLookup = new Map([
      [
        'sticky-1',
        {
          id: 'sticky-1',
          type: 'sticky',
          data: {},
          position: { x: 10, y: 10 },
          measured: { width: 80, height: 80 },
        },
      ],
    ])
    const surface = document.createElement('div')
    const pane = document.createElement('div')
    pane.className = 'react-flow__pane'
    surface.appendChild(pane)
    document.body.appendChild(surface)
    const surfaceRef = { current: surface }

    const { unmount } = renderHook(() =>
      useCanvasSelectionRect({
        surfaceRef,
        awareness: {
          setPresence,
        },
        interaction: {
          suppressNextSurfaceClick,
        },
        selection,
        enabled: true,
      }),
    )

    act(() => {
      pane.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 20 }),
      )
      window.dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true, clientX: 40, clientY: 60 }),
      )
      window.dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true, clientX: 90, clientY: 90 }),
      )
    })

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    expect(useCanvasPendingSelectionPreviewStore.getState().pendingNodeIds).toBeNull()
    expect(setPresence).not.toHaveBeenCalled()

    act(() => {
      flushAnimationFrame()
    })
    expect(useCanvasPendingSelectionPreviewStore.getState().pendingNodeIds).toEqual(
      new Set(['sticky-1']),
    )
    expect(setPresence).toHaveBeenCalledWith('tool.select', {
      type: 'rect',
      x: 10,
      y: 20,
      width: 80,
      height: 70,
    })

    act(() => {
      window.dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true, clientX: 100, clientY: 100 }),
      )
    })

    expect(requestAnimationFrame).toHaveBeenCalledTimes(2)

    act(() => {
      window.dispatchEvent(
        new MouseEvent('pointerup', { bubbles: true, clientX: 100, clientY: 100 }),
      )
    })

    expect(setPresence).toHaveBeenNthCalledWith(2, 'tool.select', {
      type: 'rect',
      x: 10,
      y: 20,
      width: 90,
      height: 80,
    })
    expect(setPresence).toHaveBeenLastCalledWith('tool.select', null)
    expect(selection.beginGesture).toHaveBeenCalledWith('marquee')
    expect(selection.commitGestureSelection).toHaveBeenCalledWith(['sticky-1'])
    expect(suppressNextSurfaceClick).toHaveBeenCalledTimes(1)
    expect(selection.endGesture).toHaveBeenCalled()
    expect(useCanvasPendingSelectionPreviewStore.getState().pendingNodeIds).toBeNull()

    unmount()
    surface.remove()
  })
})
