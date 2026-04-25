import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasSelectionRect } from '../use-canvas-selection-rect'
import { clearSelectToolLocalOverlay } from '../../../tools/select/select-tool-local-overlay'
import { isCanvasEmptyPaneTarget } from '../../interaction/canvas-pane-targets'
import type { CanvasEngine } from '../../../system/canvas-engine'
import type { CanvasViewportController } from '../../../system/canvas-viewport-controller'
import type { CanvasSelectionSnapshot } from '../../../tools/canvas-tool-types'
import type { Edge, Node } from '@xyflow/react'

const useCanvasModifierKeysMock = vi.hoisted(() => vi.fn(() => ({ shiftPressed: false })))

const canvasViewportMock = vi.hoisted(() => ({
  screenToCanvasPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
  getZoom: () => 1,
  getNodes: (): Array<Node> => [],
  getEdges: (): Array<Edge> => [],
}))

const storeState = vi.hoisted(() => ({
  nodeLookup: new Map(),
}))

vi.mock('../../interaction/use-canvas-modifier-keys', () => ({
  useCanvasModifierKeys: () => useCanvasModifierKeysMock(),
}))

function createCanvasEngineMock(): CanvasEngine {
  return {
    getSnapshot: () => ({
      nodes: canvasViewportMock.getNodes(),
      edges: canvasViewportMock.getEdges(),
      nodeLookup: storeState.nodeLookup,
    }),
  } as unknown as CanvasEngine
}

function createViewportControllerMock(): Pick<
  CanvasViewportController,
  'getZoom' | 'screenToCanvasPosition'
> {
  return {
    getZoom: canvasViewportMock.getZoom,
    screenToCanvasPosition: canvasViewportMock.screenToCanvasPosition,
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
    storeState.nodeLookup = new Map()
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

  it('starts marquee selection from the internal viewport but not from edge targets', () => {
    const selection = createSelectionMock()
    const surface = document.createElement('div')
    const pane = document.createElement('div')
    pane.className = 'canvas-scene'
    pane.dataset.canvasPane = 'true'
    pane.dataset.canvasPane = 'true'
    const viewport = document.createElement('div')
    viewport.dataset.canvasViewport = 'true'
    const edgeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    edgeLayer.dataset.canvasEdgeLayer = 'true'
    const edgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    edgeGroup.dataset.canvasEdgeId = 'edge-1'
    const edgePath = document.createElementNS('http://www.w3.org/2000/svg', 'path')

    edgeGroup.appendChild(edgePath)
    edgeLayer.appendChild(edgeGroup)
    viewport.appendChild(edgeLayer)
    pane.appendChild(viewport)
    surface.appendChild(pane)
    document.body.appendChild(surface)
    expect(isCanvasEmptyPaneTarget(edgePath, pane)).toBe(false)
    expect(isCanvasEmptyPaneTarget(viewport, pane)).toBe(true)

    const { unmount } = renderHook(() =>
      useCanvasSelectionRect({
        canvasEngine: createCanvasEngineMock(),
        viewportController: createViewportControllerMock(),
        surfaceRef: { current: surface },
        awareness: { setPresence: vi.fn() },
        interaction: { suppressNextSurfaceClick: vi.fn() },
        selection,
        enabled: true,
      }),
    )

    act(() => {
      edgePath.dispatchEvent(createPointerDownEvent({ clientX: 10, clientY: 20 }))
    })
    expect(selection.beginGesture).not.toHaveBeenCalled()

    act(() => {
      viewport.dispatchEvent(createPointerDownEvent({ clientX: 10, clientY: 20 }))
      window.dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true, clientX: 20, clientY: 30 }),
      )
      flushAnimationFrame()
    })
    expect(selection.beginGesture).toHaveBeenCalledWith('marquee', 'replace')

    unmount()
    surface.remove()
  })

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
    const getNodesSpy = vi.spyOn(canvasViewportMock, 'getNodes').mockReturnValue([
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
    const getEdgesSpy = vi.spyOn(canvasViewportMock, 'getEdges').mockReturnValue([
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
    pane.className = 'canvas-scene'
    pane.dataset.canvasPane = 'true'
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
    const getNodesSpy = vi.spyOn(canvasViewportMock, 'getNodes').mockReturnValue([
      {
        id: 'text-1',
        type: 'text',
        data: {},
        position: { x: 10, y: 10 },
        width: 80,
        height: 80,
      },
    ])
    const getEdgesSpy = vi.spyOn(canvasViewportMock, 'getEdges').mockReturnValue([])
    const surface = document.createElement('div')
    const pane = document.createElement('div')
    pane.className = 'canvas-scene'
    pane.dataset.canvasPane = 'true'
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
    const getNodesSpy = vi.spyOn(canvasViewportMock, 'getNodes').mockReturnValue([
      {
        id: 'text-1',
        type: 'text',
        data: {},
        position: { x: 10, y: 10 },
        width: 80,
        height: 80,
      },
    ])
    const getEdgesSpy = vi.spyOn(canvasViewportMock, 'getEdges').mockReturnValue([])
    const surface = document.createElement('div')
    const pane = document.createElement('div')
    pane.className = 'canvas-scene'
    pane.dataset.canvasPane = 'true'
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
    const getNodesSpy = vi.spyOn(canvasViewportMock, 'getNodes').mockReturnValue([
      {
        id: 'text-1',
        type: 'text',
        data: {},
        position: { x: 10, y: 10 },
        width: 80,
        height: 80,
      },
    ])
    const getEdgesSpy = vi.spyOn(canvasViewportMock, 'getEdges').mockReturnValue([])
    const surface = document.createElement('div')
    const pane = document.createElement('div')
    pane.className = 'canvas-scene'
    pane.dataset.canvasPane = 'true'
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

    const { unmount } = renderHook((props: typeof hookProps) => useCanvasSelectionRect(props), {
      initialProps: hookProps,
    })

    act(() => {
      pane.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 20 }),
      )
    })

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Shift' }))
      window.dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true, clientX: 70, clientY: 40, shiftKey: true }),
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
    const getNodesSpy = vi.spyOn(canvasViewportMock, 'getNodes').mockReturnValue([
      {
        id: 'text-1',
        type: 'text',
        data: {},
        position: { x: 10, y: 10 },
        width: 80,
        height: 80,
      },
    ])
    const getEdgesSpy = vi.spyOn(canvasViewportMock, 'getEdges').mockReturnValue([])
    const surface = document.createElement('div')
    const pane = document.createElement('div')
    pane.className = 'canvas-scene'
    pane.dataset.canvasPane = 'true'
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

    const { unmount } = renderHook((props: typeof hookProps) => useCanvasSelectionRect(props), {
      initialProps: hookProps,
    })

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

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Shift' }))
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

function createPointerDownEvent({ clientX, clientY }: { clientX: number; clientY: number }) {
  const EventCtor = typeof PointerEvent === 'undefined' ? MouseEvent : PointerEvent
  return new EventCtor('pointerdown', { bubbles: true, button: 0, clientX, clientY })
}
