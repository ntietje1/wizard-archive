import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasSelectionRect } from '../use-canvas-selection-rect'
import { clearSelectToolLocalOverlay } from '../../../tools/select/select-tool-local-overlay'
import type { CanvasEngine } from '../../../system/canvas-engine'
import type { CanvasViewportController } from '../../../system/canvas-viewport-controller'
import type { CanvasSelectionSnapshot } from '../../../tools/canvas-tool-types'
import type { Edge, Node } from '@xyflow/react'

const useCanvasModifierKeysMock = vi.hoisted(() => vi.fn(() => ({ shiftPressed: false })))

const reactFlowMock = vi.hoisted(() => ({
  screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
  getZoom: () => 1,
  getNodes: (): Array<Node> => [],
  getEdges: (): Array<Edge> => [],
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

vi.mock('../../interaction/use-canvas-modifier-keys', () => ({
  useCanvasModifierKeys: () => useCanvasModifierKeysMock(),
}))

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>

  return {
    ...actual,
    useReactFlow: () => reactFlowMock,
    useStoreApi: () => storeApiMock,
  }
})

function createCanvasEngineMock(): CanvasEngine {
  return {
    getSnapshot: () => ({
      nodes: reactFlowMock.getNodes(),
      edges: reactFlowMock.getEdges(),
      nodeLookup: storeState.nodeLookup,
    }),
  } as unknown as CanvasEngine
}

function createViewportControllerMock(): Pick<
  CanvasViewportController,
  'getZoom' | 'screenToCanvasPosition'
> {
  return {
    getZoom: reactFlowMock.getZoom,
    screenToCanvasPosition: reactFlowMock.screenToFlowPosition,
  }
}

describe('useCanvasSelectionRect', () => {
  const FIXED_RAF_TIMESTAMP = 1000
  const rafCallbacks = new Map<number, FrameRequestCallback>()
  let nextRafId = 1
  let pendingPreview: CanvasSelectionSnapshot | null = null

  beforeEach(() => {
    clearSelectToolLocalOverlay()
    pendingPreview = null
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
    useCanvasModifierKeysMock.mockReturnValue({ shiftPressed: false })
  })

  function flushAnimationFrame() {
    const callbacks = Array.from(rafCallbacks.entries())
    rafCallbacks.clear()

    for (const [, callback] of callbacks) {
      callback(FIXED_RAF_TIMESTAMP)
    }
  }

  function createSelectionMock(
    snapshot: CanvasSelectionSnapshot = {
      nodeIds: new Set<string>(),
      edgeIds: new Set<string>(),
    },
  ) {
    return {
      getSnapshot: vi.fn(() => snapshot),
      beginGesture: vi.fn(),
      setGesturePreview: vi.fn((preview: CanvasSelectionSnapshot | null) => {
        pendingPreview = preview
      }),
      commitGesture: vi.fn(),
      cancelGesture: vi.fn(),
    }
  }

  it('coalesces marquee preview updates and commits the last rendered preview without recomputing on release', () => {
    const setPresence = vi.fn()
    const suppressNextSurfaceClick = vi.fn()
    const selection = createSelectionMock()
    storeState.nodeLookup = new Map([
      [
        'text-1',
        {
          id: 'text-1',
          type: 'text',
          data: {},
          position: { x: 10, y: 10 },
          measured: { width: 80, height: 80 },
        },
      ],
      [
        'text-2',
        {
          id: 'text-2',
          type: 'text',
          data: {},
          position: { x: 120, y: 10 },
          measured: { width: 80, height: 80 },
        },
      ],
    ])
    const getNodesSpy = vi.spyOn(reactFlowMock, 'getNodes').mockReturnValue([
      {
        id: 'text-1',
        type: 'text',
        data: {},
        position: { x: 10, y: 10 },
        width: 80,
        height: 80,
      },
      {
        id: 'text-2',
        type: 'text',
        data: {},
        position: { x: 120, y: 10 },
        width: 80,
        height: 80,
      },
    ])
    const getEdgesSpy = vi.spyOn(reactFlowMock, 'getEdges').mockReturnValue([
      {
        id: 'edge-1',
        type: 'bezier',
        source: 'text-1',
        target: 'text-2',
        sourceHandle: 'right',
        targetHandle: 'left',
      },
    ])
    const surface = document.createElement('div')
    const pane = document.createElement('div')
    pane.className = 'react-flow__pane'
    surface.appendChild(pane)
    document.body.appendChild(surface)
    const surfaceRef = { current: surface }

    const { unmount } = renderHook(() =>
      useCanvasSelectionRect({
        canvasEngine: createCanvasEngineMock(),
        viewportController: createViewportControllerMock(),
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
    expect(pendingPreview).toBeNull()
    expect(setPresence).not.toHaveBeenCalled()

    act(() => {
      flushAnimationFrame()
    })
    expect(pendingPreview).toEqual({
      nodeIds: new Set(['text-1']),
      edgeIds: new Set(),
    })
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

    expect(setPresence).toHaveBeenCalledTimes(2)
    expect(setPresence).toHaveBeenLastCalledWith('tool.select', null)
    expect(selection.beginGesture).toHaveBeenCalledWith('marquee', 'replace')
    expect(pendingPreview).toEqual({
      nodeIds: new Set(['text-1']),
      edgeIds: new Set(),
    })
    expect(selection.commitGesture).toHaveBeenCalledTimes(1)
    expect(suppressNextSurfaceClick).toHaveBeenCalledTimes(1)

    unmount()
    surface.remove()
    getNodesSpy.mockRestore()
    getEdgesSpy.mockRestore()
  })

  it('commits additive marquee selection when the primary modifier is held at drag start', () => {
    const selection = createSelectionMock({
      nodeIds: new Set(['text-existing']),
      edgeIds: new Set(['edge-existing']),
    })
    storeState.nodeLookup = new Map([
      [
        'text-1',
        {
          id: 'text-1',
          type: 'text',
          data: {},
          position: { x: 10, y: 10 },
          measured: { width: 80, height: 80 },
        },
      ],
    ])
    const getNodesSpy = vi.spyOn(reactFlowMock, 'getNodes').mockReturnValue([
      {
        id: 'text-1',
        type: 'text',
        data: {},
        position: { x: 10, y: 10 },
        width: 80,
        height: 80,
      },
    ])
    const getEdgesSpy = vi.spyOn(reactFlowMock, 'getEdges').mockReturnValue([])
    const surface = document.createElement('div')
    const pane = document.createElement('div')
    pane.className = 'react-flow__pane'
    surface.appendChild(pane)
    document.body.appendChild(surface)
    const surfaceRef = { current: surface }

    const { unmount } = renderHook(() =>
      useCanvasSelectionRect({
        canvasEngine: createCanvasEngineMock(),
        viewportController: createViewportControllerMock(),
        surfaceRef,
        awareness: {
          setPresence: vi.fn(),
        },
        interaction: {
          suppressNextSurfaceClick: vi.fn(),
        },
        selection,
        enabled: true,
      }),
    )

    act(() => {
      pane.dispatchEvent(
        new MouseEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: 10,
          clientY: 20,
          ctrlKey: true,
        }),
      )
      window.dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true, clientX: 50, clientY: 60 }),
      )
    })

    act(() => {
      flushAnimationFrame()
    })

    expect(pendingPreview).toEqual({
      nodeIds: new Set(['text-existing', 'text-1']),
      edgeIds: new Set(['edge-existing']),
    })
    expect(selection.beginGesture).toHaveBeenCalledWith('marquee', 'add')

    act(() => {
      window.dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true, clientX: 90, clientY: 90 }),
      )
      window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 90, clientY: 90 }))
    })

    expect(selection.commitGesture).toHaveBeenCalledTimes(1)

    unmount()
    surface.remove()
    getNodesSpy.mockRestore()
    getEdgesSpy.mockRestore()
  })

  it('uses a square marquee when shift is held during selection', () => {
    useCanvasModifierKeysMock.mockReturnValue({ shiftPressed: true })
    const selection = createSelectionMock()
    storeState.nodeLookup = new Map([
      [
        'text-1',
        {
          id: 'text-1',
          type: 'text',
          data: {},
          position: { x: 10, y: 10 },
          measured: { width: 80, height: 80 },
        },
      ],
    ])
    const getNodesSpy = vi.spyOn(reactFlowMock, 'getNodes').mockReturnValue([
      {
        id: 'text-1',
        type: 'text',
        data: {},
        position: { x: 10, y: 10 },
        width: 80,
        height: 80,
      },
    ])
    const getEdgesSpy = vi.spyOn(reactFlowMock, 'getEdges').mockReturnValue([])
    const surface = document.createElement('div')
    const pane = document.createElement('div')
    pane.className = 'react-flow__pane'
    surface.appendChild(pane)
    document.body.appendChild(surface)
    const surfaceRef = { current: surface }

    const { unmount } = renderHook(() =>
      useCanvasSelectionRect({
        canvasEngine: createCanvasEngineMock(),
        viewportController: createViewportControllerMock(),
        surfaceRef,
        awareness: {
          setPresence: vi.fn(),
        },
        interaction: {
          suppressNextSurfaceClick: vi.fn(),
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
        new MouseEvent('pointermove', { bubbles: true, clientX: 70, clientY: 40 }),
      )
      flushAnimationFrame()
      window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 70, clientY: 40 }))
    })

    expect(selection.commitGesture).toHaveBeenCalledTimes(1)

    unmount()
    surface.remove()
    getNodesSpy.mockRestore()
    getEdgesSpy.mockRestore()
  })

  it('keeps an in-progress marquee active when shift is pressed mid-drag and constrains it to a square', () => {
    const setPresence = vi.fn()
    const selection = createSelectionMock()
    storeState.nodeLookup = new Map([
      [
        'text-1',
        {
          id: 'text-1',
          type: 'text',
          data: {},
          position: { x: 10, y: 10 },
          measured: { width: 80, height: 80 },
        },
      ],
    ])
    const getNodesSpy = vi.spyOn(reactFlowMock, 'getNodes').mockReturnValue([
      {
        id: 'text-1',
        type: 'text',
        data: {},
        position: { x: 10, y: 10 },
        width: 80,
        height: 80,
      },
    ])
    const getEdgesSpy = vi.spyOn(reactFlowMock, 'getEdges').mockReturnValue([])
    const surface = document.createElement('div')
    const pane = document.createElement('div')
    pane.className = 'react-flow__pane'
    surface.appendChild(pane)
    document.body.appendChild(surface)
    const surfaceRef = { current: surface }

    useCanvasModifierKeysMock.mockReturnValue({ shiftPressed: false })

    const interaction = {
      suppressNextSurfaceClick: vi.fn(),
    }
    const awareness = {
      setPresence,
    }
    const hookProps = {
      surfaceRef,
      canvasEngine: createCanvasEngineMock(),
      viewportController: createViewportControllerMock(),
      awareness,
      interaction,
      selection,
      enabled: true,
    }

    const { rerender, unmount } = renderHook(
      (props: typeof hookProps) => useCanvasSelectionRect(props),
      {
        initialProps: hookProps,
      },
    )

    act(() => {
      pane.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 20 }),
      )
    })

    useCanvasModifierKeysMock.mockReturnValue({ shiftPressed: true })
    rerender(hookProps)

    act(() => {
      window.dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true, clientX: 70, clientY: 40 }),
      )
      flushAnimationFrame()
      window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 70, clientY: 40 }))
    })

    expect(setPresence).toHaveBeenCalledWith('tool.select', {
      type: 'rect',
      x: 10,
      y: 20,
      width: 20,
      height: 20,
    })
    expect(selection.commitGesture).toHaveBeenCalledTimes(1)

    unmount()
    surface.remove()
    getNodesSpy.mockRestore()
    getEdgesSpy.mockRestore()
  })

  it('recomputes the active marquee when shift is pressed without any further pointer movement', () => {
    const setPresence = vi.fn()
    const selection = createSelectionMock()
    storeState.nodeLookup = new Map([
      [
        'text-1',
        {
          id: 'text-1',
          type: 'text',
          data: {},
          position: { x: 10, y: 10 },
          measured: { width: 80, height: 80 },
        },
      ],
    ])
    const getNodesSpy = vi.spyOn(reactFlowMock, 'getNodes').mockReturnValue([
      {
        id: 'text-1',
        type: 'text',
        data: {},
        position: { x: 10, y: 10 },
        width: 80,
        height: 80,
      },
    ])
    const getEdgesSpy = vi.spyOn(reactFlowMock, 'getEdges').mockReturnValue([])
    const surface = document.createElement('div')
    const pane = document.createElement('div')
    pane.className = 'react-flow__pane'
    surface.appendChild(pane)
    document.body.appendChild(surface)
    const surfaceRef = { current: surface }
    const interaction = {
      suppressNextSurfaceClick: vi.fn(),
    }
    const awareness = {
      setPresence,
    }
    const hookProps = {
      surfaceRef,
      canvasEngine: createCanvasEngineMock(),
      viewportController: createViewportControllerMock(),
      awareness,
      interaction,
      selection,
      enabled: true,
    }

    useCanvasModifierKeysMock.mockReturnValue({ shiftPressed: false })

    const { rerender, unmount } = renderHook(
      (props: typeof hookProps) => useCanvasSelectionRect(props),
      {
        initialProps: hookProps,
      },
    )

    act(() => {
      pane.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 20 }),
      )
      window.dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true, clientX: 70, clientY: 40 }),
      )
      flushAnimationFrame()
    })

    expect(setPresence).toHaveBeenCalledWith('tool.select', {
      type: 'rect',
      x: 10,
      y: 20,
      width: 60,
      height: 20,
    })

    useCanvasModifierKeysMock.mockReturnValue({ shiftPressed: true })
    rerender(hookProps)

    act(() => {
      flushAnimationFrame()
    })

    expect(setPresence).toHaveBeenNthCalledWith(2, 'tool.select', {
      type: 'rect',
      x: 10,
      y: 20,
      width: 20,
      height: 20,
    })

    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 70, clientY: 40 }))
    })

    expect(selection.commitGesture).toHaveBeenCalledTimes(1)

    unmount()
    surface.remove()
    getNodesSpy.mockRestore()
    getEdgesSpy.mockRestore()
  })
})
