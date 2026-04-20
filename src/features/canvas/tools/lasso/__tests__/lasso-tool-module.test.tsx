import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lassoToolModule } from '../lasso-tool-module'
import {
  clearCanvasPendingSelectionPreview,
  useCanvasPendingSelectionPreviewStore,
} from '../../../runtime/selection/use-canvas-pending-selection-preview'
import {
  clearLassoToolLocalOverlay,
  useLassoToolLocalOverlayStore,
} from '../lasso-tool-local-overlay'
import type { Edge, Node } from '@xyflow/react'
import type {
  CanvasMeasuredNode,
  CanvasToolEnvironment,
  CanvasToolId,
} from '../../canvas-tool-types'

type MockPointerTarget = HTMLDivElement & {
  setPointerCapture: (pointerId: number) => void
  releasePointerCapture: (pointerId: number) => void
}

function createPointerTarget() {
  const target = document.createElement('div') as unknown as MockPointerTarget
  target.setPointerCapture = vi.fn()
  target.releasePointerCapture = vi.fn()
  return target
}

function createPointerEvent(
  target: Element,
  overrides: Partial<PointerEvent> & { clientX: number; clientY: number },
): PointerEvent {
  return {
    button: 0,
    buttons: 1,
    pointerId: 1,
    target,
    ...overrides,
  } as PointerEvent
}

describe('lassoToolModule', () => {
  const rafCallbacks = new Map<number, FrameRequestCallback>()
  let nextRafId = 1

  beforeEach(() => {
    clearLassoToolLocalOverlay()
    clearCanvasPendingSelectionPreview()
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
    const callbacks = Array.from(rafCallbacks.values())
    rafCallbacks.clear()

    for (const callback of callbacks) {
      callback(performance.now())
    }
  }

  it('coalesces lasso preview updates to one animation frame and still commits the latest polygon', () => {
    const clear = vi.fn()
    const commitGestureSelection = vi.fn()
    const beginGesture = vi.fn()
    const endGesture = vi.fn()
    const suppressNextSurfaceClick = vi.fn()
    const setActiveTool = vi.fn()
    const setPresence = vi.fn()
    const runtime = createLassoEnvironment({
      getMeasuredNodes: () => [
        {
          id: 'embed-1',
          type: 'embed',
          position: { x: 20, y: 20 },
          width: 40,
          height: 40,
          data: {},
        },
        {
          id: 'embed-2',
          type: 'embed',
          position: { x: 120, y: 20 },
          width: 40,
          height: 40,
          data: {},
        },
      ],
      getNodes: () => [
        {
          id: 'embed-1',
          type: 'embed',
          position: { x: 20, y: 20 },
          width: 40,
          height: 40,
          data: {},
        },
        {
          id: 'embed-2',
          type: 'embed',
          position: { x: 120, y: 20 },
          width: 40,
          height: 40,
          data: {},
        },
      ],
      getEdges: () => [
        {
          id: 'edge-1',
          type: 'bezier',
          source: 'embed-1',
          target: 'embed-2',
          sourceHandle: 'right',
          targetHandle: 'left',
        },
      ],
      commitGestureSelection,
      clear,
      beginGesture,
      endGesture,
      suppressNextSurfaceClick,
      setPresence,
      setActiveTool,
    })

    const controller = lassoToolModule.create(runtime)
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 100, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 100, clientY: 100 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 0, clientY: 100 }))

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    expect(setPresence).not.toHaveBeenCalled()
    expect(useCanvasPendingSelectionPreviewStore.getState().pendingNodeIds).toBeNull()

    flushAnimationFrame()

    expect(useCanvasPendingSelectionPreviewStore.getState().pendingNodeIds).toEqual(
      new Set(['embed-1']),
    )
    expect(useCanvasPendingSelectionPreviewStore.getState().pendingEdgeIds).toEqual(
      new Set(['edge-1']),
    )
    expect(setPresence).toHaveBeenCalledTimes(1)

    controller.onPointerMove?.(createPointerEvent(target, { clientX: -20, clientY: 50 }))
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2)

    controller.onPointerUp?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))

    expect(beginGesture).toHaveBeenCalledWith('lasso')
    expect(clear).toHaveBeenCalledTimes(1)
    expect(useLassoToolLocalOverlayStore.getState().points).toEqual([])
    expect(setPresence).toHaveBeenCalledWith(
      'tool.lasso',
      expect.objectContaining({ type: 'lasso' }),
    )
    expect(setPresence).toHaveBeenLastCalledWith('tool.lasso', null)
    expect(suppressNextSurfaceClick).toHaveBeenCalledTimes(1)
    expect(commitGestureSelection).toHaveBeenCalledWith({
      nodeIds: ['embed-1'],
      edgeIds: ['edge-1'],
    })
    expect(endGesture).toHaveBeenCalled()
    expect(setActiveTool).toHaveBeenCalledWith('select')
    expect(target.setPointerCapture).toHaveBeenCalledWith(1)
    expect(target.releasePointerCapture).toHaveBeenCalledWith(1)
    expect(useCanvasPendingSelectionPreviewStore.getState().pendingNodeIds).toBeNull()
    expect(useCanvasPendingSelectionPreviewStore.getState().pendingEdgeIds).toEqual(new Set())
  })

  it('publishes a fresh local lasso path array on each pointer update so the local overlay rerenders', () => {
    const controller = lassoToolModule.create(
      createLassoEnvironment({
        getMeasuredNodes: () => [],
        getNodes: () => [],
        getEdges: () => [],
        clear: vi.fn(),
        commitGestureSelection: vi.fn(),
        beginGesture: vi.fn(),
        endGesture: vi.fn(),
        suppressNextSurfaceClick: vi.fn(),
        setPresence: vi.fn(),
        setActiveTool: vi.fn(),
      }),
    )
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    const firstPath = useLassoToolLocalOverlayStore.getState().points
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 100, clientY: 0 }))
    const secondPath = useLassoToolLocalOverlayStore.getState().points
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 100, clientY: 100 }))
    const thirdPath = useLassoToolLocalOverlayStore.getState().points

    flushAnimationFrame()

    expect(firstPath).toEqual([{ x: 0, y: 0 }])
    expect(secondPath).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ])
    expect(thirdPath).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ])
    expect(secondPath).not.toBe(firstPath)
    expect(thirdPath).not.toBe(secondPath)
    expect(useCanvasPendingSelectionPreviewStore.getState().pendingNodeIds).toEqual(new Set())
    expect(useCanvasPendingSelectionPreviewStore.getState().pendingEdgeIds).toEqual(new Set())
  })

  it('clears selection when no measured nodes fall inside the lasso', () => {
    const commitGestureSelection = vi.fn()
    const controller = lassoToolModule.create(
      createLassoEnvironment({
        getMeasuredNodes: () => [
          {
            id: 'outside-node',
            type: 'embed',
            position: { x: 200, y: 200 },
            width: 40,
            height: 40,
            data: {},
          },
        ],
        getNodes: () => [
          {
            id: 'outside-node',
            type: 'embed',
            position: { x: 200, y: 200 },
            width: 40,
            height: 40,
            data: {},
          },
        ],
        getEdges: () => [],
        clear: vi.fn(),
        commitGestureSelection,
        beginGesture: vi.fn(),
        endGesture: vi.fn(),
        suppressNextSurfaceClick: vi.fn(),
        setPresence: vi.fn(),
        setActiveTool: vi.fn(),
      }),
    )
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 100, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 100, clientY: 100 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 0, clientY: 100 }))
    flushAnimationFrame()
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))

    expect(commitGestureSelection).toHaveBeenCalledWith({ nodeIds: [], edgeIds: [] })
    expect(useCanvasPendingSelectionPreviewStore.getState().pendingNodeIds).toBeNull()
    expect(useCanvasPendingSelectionPreviewStore.getState().pendingEdgeIds).toEqual(new Set())
  })

  it('selects only the measured nodes that are fully enclosed by the lasso', () => {
    const commitGestureSelection = vi.fn()
    const suppressNextSurfaceClick = vi.fn()
    const controller = lassoToolModule.create(
      createLassoEnvironment({
        getMeasuredNodes: () => [
          {
            id: 'inside-node',
            type: 'embed',
            position: { x: 20, y: 20 },
            width: 40,
            height: 40,
            data: {},
          },
          {
            id: 'outside-node',
            type: 'embed',
            position: { x: 200, y: 200 },
            width: 40,
            height: 40,
            data: {},
          },
          {
            id: 'partially-outside-node',
            type: 'embed',
            position: { x: 80, y: 80 },
            width: 40,
            height: 40,
            data: {},
          },
        ],
        getNodes: () => [
          {
            id: 'inside-node',
            type: 'embed',
            position: { x: 20, y: 20 },
            width: 40,
            height: 40,
            data: {},
          },
          {
            id: 'outside-node',
            type: 'embed',
            position: { x: 200, y: 200 },
            width: 40,
            height: 40,
            data: {},
          },
          {
            id: 'partially-outside-node',
            type: 'embed',
            position: { x: 80, y: 80 },
            width: 40,
            height: 40,
            data: {},
          },
          {
            id: 'edge-node',
            type: 'embed',
            position: { x: 120, y: 20 },
            width: 40,
            height: 40,
            data: {},
          },
        ],
        getEdges: () => [
          {
            id: 'edge-1',
            type: 'bezier',
            source: 'inside-node',
            target: 'edge-node',
            sourceHandle: 'right',
            targetHandle: 'left',
          },
        ],
        clear: vi.fn(),
        commitGestureSelection,
        beginGesture: vi.fn(),
        endGesture: vi.fn(),
        suppressNextSurfaceClick,
        setPresence: vi.fn(),
        setActiveTool: vi.fn(),
      }),
    )
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 100, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 100, clientY: 100 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 0, clientY: 100 }))
    flushAnimationFrame()
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))

    expect(commitGestureSelection).toHaveBeenCalledWith({
      nodeIds: ['inside-node'],
      edgeIds: ['edge-1'],
    })
    expect(suppressNextSurfaceClick).toHaveBeenCalledTimes(1)
  })
})

function createLassoEnvironment({
  getMeasuredNodes,
  getNodes,
  getEdges,
  clear,
  commitGestureSelection,
  beginGesture,
  endGesture,
  suppressNextSurfaceClick,
  setPresence,
  setActiveTool,
}: {
  getMeasuredNodes: () => Array<CanvasMeasuredNode>
  getNodes: () => Array<Node>
  getEdges: () => Array<Edge>
  clear: () => void
  commitGestureSelection: (selection: { nodeIds: Array<string>; edgeIds: Array<string> }) => void
  beginGesture: (kind: 'marquee' | 'lasso') => void
  endGesture: () => void
  suppressNextSurfaceClick: () => void
  setPresence: (namespace: string, value: unknown) => void
  setActiveTool: (tool: CanvasToolId) => void
}): CanvasToolEnvironment {
  return {
    viewport: {
      screenToFlowPosition: ({ x, y }) => ({ x, y }),
      getZoom: () => 1,
    },
    document: {
      createNode: () => undefined,
      updateNode: () => undefined,
      updateNodeData: () => undefined,
      resizeNode: () => undefined,
      deleteNodes: () => undefined,
      createEdge: () => undefined,
      deleteEdges: () => undefined,
      setNodePosition: () => undefined,
      getNodes,
      getEdges,
      getMeasuredNodes,
    },
    selection: {
      replace: vi.fn(),
      replaceNodes: vi.fn(),
      replaceEdges: vi.fn(),
      clear,
      getSelectedNodeIds: () => [],
      getSelectedEdgeIds: () => [],
      toggleNodeFromTarget: vi.fn(),
      toggleEdgeFromTarget: vi.fn(),
      beginGesture,
      commitGestureSelection,
      endGesture,
    },
    interaction: {
      suppressNextSurfaceClick,
    },
    editSession: {
      editingEmbedId: null,
      setEditingEmbedId: () => undefined,
      pendingEditNodeId: null,
      setPendingEditNodeId: () => undefined,
    },
    toolState: {
      getSettings: () => ({
        strokeColor: 'var(--foreground)',
        strokeOpacity: 100,
        strokeSize: 4,
      }),
      getActiveTool: () => 'lasso',
      setActiveTool,
      setStrokeColor: () => undefined,
      setStrokeSize: () => undefined,
      setStrokeOpacity: () => undefined,
    },
    awareness: {
      core: {
        setLocalCursor: () => undefined,
        setLocalDragging: () => undefined,
        setLocalResizing: () => undefined,
        setLocalSelection: () => undefined,
      },
      presence: {
        setPresence,
      },
    },
  }
}
