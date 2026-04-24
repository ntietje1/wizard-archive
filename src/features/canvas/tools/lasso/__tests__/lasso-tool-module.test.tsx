import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lassoToolSpec } from '../lasso-tool-module'
import {
  clearCanvasPendingSelectionPreview,
  getCanvasPendingSelectionPreview,
} from '../../../runtime/selection/use-canvas-pending-selection-preview'
import {
  clearLassoToolLocalOverlay,
  useLassoToolLocalOverlayStore,
} from '../lasso-tool-local-overlay'
import type { Edge, Node } from '@xyflow/react'
import type {
  CanvasMeasuredNode,
  CanvasToolId,
  CanvasToolRuntime,
  CanvasSelectionCommitMode,
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

function createEmbedNode(id: string, x: number, y: number): CanvasMeasuredNode {
  return {
    id,
    type: 'embed',
    position: { x, y },
    width: 40,
    height: 40,
    data: {},
  }
}

function drawRectangleLasso(
  controller: ReturnType<typeof lassoToolSpec.createHandlers>,
  target: Element,
  pointerDownOverrides: Partial<PointerEvent> = {},
) {
  controller.onPointerDown?.(
    createPointerEvent(target, { clientX: 0, clientY: 0, ...pointerDownOverrides }),
  )
  controller.onPointerMove?.(createPointerEvent(target, { clientX: 100, clientY: 0 }))
  controller.onPointerMove?.(createPointerEvent(target, { clientX: 100, clientY: 100 }))
  controller.onPointerMove?.(createPointerEvent(target, { clientX: 0, clientY: 100 }))
}

describe('lassoToolSpec', () => {
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
    const commitGestureSelection = vi.fn()
    const beginGesture = vi.fn()
    const endGesture = vi.fn()
    const suppressNextSurfaceClick = vi.fn()
    const setPresence = vi.fn()
    const runtime = createLassoEnvironment({
      getMeasuredNodes: () => [
        createEmbedNode('embed-1', 20, 20),
        createEmbedNode('embed-2', 120, 20),
      ],
      getNodes: () => [createEmbedNode('embed-1', 20, 20), createEmbedNode('embed-2', 120, 20)],
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
      beginGesture,
      endGesture,
      suppressNextSurfaceClick,
      setPresence,
    })

    const controller = lassoToolSpec.createHandlers(runtime)
    const target = createPointerTarget()

    drawRectangleLasso(controller, target)

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    expect(setPresence).not.toHaveBeenCalled()
    expect(getCanvasPendingSelectionPreview()).toEqual({ kind: 'inactive' })

    flushAnimationFrame()

    expect(getCanvasPendingSelectionPreview()).toEqual({
      kind: 'active',
      nodeIds: new Set(['embed-1']),
      edgeIds: new Set(['edge-1']),
    })
    expect(setPresence).toHaveBeenCalledTimes(1)

    controller.onPointerMove?.(createPointerEvent(target, { clientX: -20, clientY: 50 }))
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2)

    controller.onPointerUp?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))

    expect(beginGesture).toHaveBeenCalledWith('lasso')
    expect(useLassoToolLocalOverlayStore.getState().points).toEqual([])
    expect(setPresence).toHaveBeenCalledWith(
      'tool.lasso',
      expect.objectContaining({ type: 'lasso' }),
    )
    expect(setPresence).toHaveBeenLastCalledWith('tool.lasso', null)
    expect(suppressNextSurfaceClick).toHaveBeenCalledTimes(1)
    expect(commitGestureSelection).toHaveBeenCalledWith(
      {
        nodeIds: ['embed-1'],
        edgeIds: ['edge-1'],
      },
      'replace',
    )
    expect(endGesture).toHaveBeenCalled()
    expect(target.setPointerCapture).toHaveBeenCalledWith(1)
    expect(target.releasePointerCapture).toHaveBeenCalledWith(1)
    expect(getCanvasPendingSelectionPreview()).toEqual({ kind: 'inactive' })
  })

  it('publishes a fresh local lasso path array on each pointer update so the local overlay rerenders', () => {
    const controller = lassoToolSpec.createHandlers(
      createLassoEnvironment({
        getMeasuredNodes: () => [],
        getNodes: () => [],
        getEdges: () => [],
        commitGestureSelection: vi.fn(),
        beginGesture: vi.fn(),
        endGesture: vi.fn(),
        suppressNextSurfaceClick: vi.fn(),
        setPresence: vi.fn(),
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
    expect(getCanvasPendingSelectionPreview()).toEqual({
      kind: 'active',
      nodeIds: new Set(),
      edgeIds: new Set(),
    })
  })

  it('clears selection when no measured nodes fall inside the lasso', () => {
    const commitGestureSelection = vi.fn()
    const clear = vi.fn()
    const controller = lassoToolSpec.createHandlers(
      createLassoEnvironment({
        getMeasuredNodes: () => [createEmbedNode('outside-node', 200, 200)],
        getNodes: () => [createEmbedNode('outside-node', 200, 200)],
        getEdges: () => [],
        commitGestureSelection,
        beginGesture: vi.fn(),
        endGesture: vi.fn(),
        clearSelection: clear,
        suppressNextSurfaceClick: vi.fn(),
        setPresence: vi.fn(),
      }),
    )
    const target = createPointerTarget()

    drawRectangleLasso(controller, target)
    flushAnimationFrame()
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))

    expect(commitGestureSelection).toHaveBeenCalledWith({ nodeIds: [], edgeIds: [] }, 'replace')
    expect(clear).not.toHaveBeenCalled()
    expect(getCanvasPendingSelectionPreview()).toEqual({ kind: 'inactive' })
  })

  it('clears selection on a point click without committing a lasso selection', () => {
    const clear = vi.fn()
    const commitGestureSelection = vi.fn()
    const endGesture = vi.fn()
    const controller = lassoToolSpec.createHandlers(
      createLassoEnvironment({
        getMeasuredNodes: () => [],
        getNodes: () => [],
        getEdges: () => [],
        commitGestureSelection,
        beginGesture: vi.fn(),
        endGesture,
        clearSelection: clear,
        suppressNextSurfaceClick: vi.fn(),
        setPresence: vi.fn(),
      }),
    )
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))

    expect(clear).toHaveBeenCalledTimes(1)
    expect(commitGestureSelection).not.toHaveBeenCalled()
    expect(endGesture).toHaveBeenCalledTimes(1)
    expect(target.releasePointerCapture).toHaveBeenCalledWith(1)
    expect(getCanvasPendingSelectionPreview()).toEqual({ kind: 'inactive' })
  })

  it('selects nodes and edges when the lasso contacts them', () => {
    const commitGestureSelection = vi.fn()
    const suppressNextSurfaceClick = vi.fn()
    const controller = lassoToolSpec.createHandlers(
      createLassoEnvironment({
        getMeasuredNodes: () => [
          createEmbedNode('inside-node', 20, 20),
          createEmbedNode('outside-node', 200, 200),
          createEmbedNode('contact-node', 80, 80),
        ],
        getNodes: () => [
          createEmbedNode('inside-node', 20, 20),
          createEmbedNode('outside-node', 200, 200),
          createEmbedNode('contact-node', 80, 80),
          createEmbedNode('edge-node', 120, 20),
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
        commitGestureSelection,
        beginGesture: vi.fn(),
        endGesture: vi.fn(),
        suppressNextSurfaceClick,
        setPresence: vi.fn(),
      }),
    )
    const target = createPointerTarget()

    drawRectangleLasso(controller, target)
    flushAnimationFrame()
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))

    expect(commitGestureSelection).toHaveBeenCalledWith(
      {
        nodeIds: ['inside-node', 'contact-node'],
        edgeIds: ['edge-1'],
      },
      'replace',
    )
    expect(suppressNextSurfaceClick).toHaveBeenCalledTimes(1)
  })

  it('commits additive lasso selection when the primary modifier is held at gesture start', () => {
    const commitGestureSelection = vi.fn()
    const controller = lassoToolSpec.createHandlers(
      createLassoEnvironment({
        getMeasuredNodes: () => [createEmbedNode('inside-node', 20, 20)],
        getNodes: () => [createEmbedNode('inside-node', 20, 20)],
        getEdges: () => [],
        commitGestureSelection,
        beginGesture: vi.fn(),
        endGesture: vi.fn(),
        suppressNextSurfaceClick: vi.fn(),
        setPresence: vi.fn(),
      }),
    )
    const target = createPointerTarget()

    drawRectangleLasso(controller, target, { ctrlKey: true })
    flushAnimationFrame()
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))

    expect(commitGestureSelection).toHaveBeenCalledWith(
      {
        nodeIds: ['inside-node'],
        edgeIds: [],
      },
      'add',
    )
  })

  it('keeps already-selected items in the additive lasso preview', () => {
    const controller = lassoToolSpec.createHandlers(
      createLassoEnvironment({
        getMeasuredNodes: () => [createEmbedNode('inside-node', 20, 20)],
        getNodes: () => [createEmbedNode('inside-node', 20, 20)],
        getEdges: () => [],
        selectedNodeIds: ['existing-node'],
        selectedEdgeIds: ['existing-edge'],
        commitGestureSelection: vi.fn(),
        beginGesture: vi.fn(),
        endGesture: vi.fn(),
        suppressNextSurfaceClick: vi.fn(),
        setPresence: vi.fn(),
      }),
    )
    const target = createPointerTarget()

    drawRectangleLasso(controller, target, { ctrlKey: true })
    flushAnimationFrame()

    expect(getCanvasPendingSelectionPreview()).toEqual({
      kind: 'active',
      nodeIds: new Set(['existing-node', 'inside-node']),
      edgeIds: new Set(['existing-edge']),
    })
  })

  it('keeps lasso active after successful commit and after too-small gestures', () => {
    const setActiveTool = vi.fn()
    const controller = lassoToolSpec.createHandlers(
      createLassoEnvironment({
        getMeasuredNodes: () => [],
        getNodes: () => [],
        getEdges: () => [],
        commitGestureSelection: vi.fn(),
        beginGesture: vi.fn(),
        endGesture: vi.fn(),
        suppressNextSurfaceClick: vi.fn(),
        setPresence: vi.fn(),
        setActiveTool,
      }),
    )
    const target = createPointerTarget()

    drawRectangleLasso(controller, target)
    flushAnimationFrame()
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))

    expect(setActiveTool).not.toHaveBeenCalled()
  })

  it('keeps lasso active after pointer cancellation', () => {
    const setActiveTool = vi.fn()
    const controller = lassoToolSpec.createHandlers(
      createLassoEnvironment({
        getMeasuredNodes: () => [],
        getNodes: () => [],
        getEdges: () => [],
        commitGestureSelection: vi.fn(),
        beginGesture: vi.fn(),
        endGesture: vi.fn(),
        suppressNextSurfaceClick: vi.fn(),
        setPresence: vi.fn(),
        setActiveTool,
      }),
    )
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    controller.onPointerCancel?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))

    expect(setActiveTool).not.toHaveBeenCalled()
  })
})

function createLassoEnvironment({
  getMeasuredNodes,
  getNodes,
  getEdges,
  commitGestureSelection,
  beginGesture,
  endGesture,
  suppressNextSurfaceClick,
  setPresence,
  setActiveTool,
  clearSelection,
  selectedNodeIds = [],
  selectedEdgeIds = [],
}: {
  getMeasuredNodes: () => Array<CanvasMeasuredNode>
  getNodes: () => Array<Node>
  getEdges: () => Array<Edge>
  commitGestureSelection: (
    selection: { nodeIds: Array<string>; edgeIds: Array<string> },
    mode?: CanvasSelectionCommitMode,
  ) => void
  beginGesture: (kind: 'marquee' | 'lasso') => void
  endGesture: () => void
  suppressNextSurfaceClick: () => void
  setPresence: (namespace: string, value: unknown) => void
  setActiveTool?: (tool: CanvasToolId) => void
  clearSelection?: () => void
  selectedNodeIds?: Array<string>
  selectedEdgeIds?: Array<string>
}): CanvasToolRuntime {
  return {
    viewport: {
      screenToFlowPosition: ({ x, y }) => ({ x, y }),
      getZoom: () => 1,
    },
    commands: {
      createNode: () => undefined,
      updateNode: () => undefined,
      updateNodeData: () => undefined,
      updateEdge: () => undefined,
      resizeNode: () => undefined,
      deleteNodes: () => undefined,
      createEdge: () => undefined,
      deleteEdges: () => undefined,
      setNodePosition: () => undefined,
    },
    query: {
      getNodes,
      getEdges,
      getMeasuredNodes,
    },
    selection: {
      getSnapshot: () => ({ nodeIds: selectedNodeIds, edgeIds: selectedEdgeIds }),
      replace: vi.fn(),
      replaceNodes: vi.fn(),
      replaceEdges: vi.fn(),
      clear: clearSelection ?? vi.fn(),
      getSelectedNodeIds: () => selectedNodeIds,
      getSelectedEdgeIds: () => selectedEdgeIds,
      toggleNodeFromTarget: vi.fn(),
      toggleEdgeFromTarget: vi.fn(),
      beginGesture,
      commitGestureSelection,
      endGesture,
    },
    interaction: {
      suppressNextSurfaceClick,
    },
    modifiers: {
      getShiftPressed: () => false,
      getPrimaryPressed: () => false,
    },
    editSession: {
      editingEmbedId: null,
      setEditingEmbedId: () => undefined,
      pendingEditNodeId: null,
      pendingEditNodePoint: null,
      setPendingEditNodeId: () => undefined,
      setPendingEditNodePoint: () => undefined,
    },
    toolState: {
      getSettings: () => ({
        edgeType: 'bezier',
        strokeColor: 'var(--foreground)',
        strokeOpacity: 100,
        strokeSize: 4,
      }),
      getActiveTool: () => 'lasso',
      setActiveTool: setActiveTool ?? (() => undefined),
      setEdgeType: () => undefined,
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
