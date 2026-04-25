import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lassoToolSpec } from '../lasso-tool-module'
import {
  clearLassoToolLocalOverlay,
  useLassoToolLocalOverlayStore,
} from '../lasso-tool-local-overlay'
import type { Edge, Node } from '@xyflow/react'
import type {
  CanvasMeasuredNode,
  CanvasSelectionSnapshot,
  CanvasToolId,
  CanvasToolRuntime,
} from '../../canvas-tool-types'

type MockPointerTarget = HTMLDivElement & {
  setPointerCapture: (pointerId: number) => void
  releasePointerCapture: (pointerId: number) => void
}

type TestPointerEvent = PointerEvent & {
  preventDefaultSpy: ReturnType<typeof vi.fn>
  stopPropagationSpy: ReturnType<typeof vi.fn>
}

let pendingPreview: CanvasSelectionSnapshot | null = null

function createPointerTarget() {
  const target = document.createElement('div') as unknown as MockPointerTarget
  target.setPointerCapture = vi.fn()
  target.releasePointerCapture = vi.fn()
  return target
}

function createPointerEvent(
  target: Element,
  overrides: Partial<PointerEvent> & { clientX: number; clientY: number },
): TestPointerEvent {
  const preventDefaultSpy = vi.fn()
  const stopPropagationSpy = vi.fn()

  return {
    button: 0,
    buttons: 1,
    pointerId: 1,
    target,
    preventDefault: preventDefaultSpy,
    stopPropagation: stopPropagationSpy,
    preventDefaultSpy,
    stopPropagationSpy,
    ...overrides,
  } as TestPointerEvent
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
    pendingPreview = null
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
    expect(pendingPreview).toBeNull()

    flushAnimationFrame()

    expect(pendingPreview).toEqual({
      nodeIds: new Set(['embed-1']),
      edgeIds: new Set(['edge-1']),
    })
    expect(setPresence).toHaveBeenCalledTimes(1)

    controller.onPointerMove?.(createPointerEvent(target, { clientX: -20, clientY: 50 }))
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2)

    controller.onPointerUp?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))

    expect(beginGesture).toHaveBeenCalledWith('lasso', 'replace')
    expect(useLassoToolLocalOverlayStore.getState().points).toEqual([])
    expect(setPresence).toHaveBeenCalledWith(
      'tool.lasso',
      expect.objectContaining({ type: 'lasso' }),
    )
    expect(setPresence).toHaveBeenLastCalledWith('tool.lasso', null)
    expect(suppressNextSurfaceClick).toHaveBeenCalledTimes(1)
    expect(pendingPreview).toEqual({
      nodeIds: new Set(['embed-1']),
      edgeIds: new Set(['edge-1']),
    })
    expect(target.setPointerCapture).toHaveBeenCalledWith(1)
    expect(target.releasePointerCapture).toHaveBeenCalledWith(1)
  })

  it('publishes a fresh local lasso path array on each pointer update so the local overlay rerenders', () => {
    const controller = lassoToolSpec.createHandlers(
      createLassoEnvironment({
        getMeasuredNodes: () => [],
        getNodes: () => [],
        getEdges: () => [],
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
    expect(pendingPreview).toEqual({
      nodeIds: new Set(),
      edgeIds: new Set(),
    })
  })

  it('claims active pointer events so native text selection cannot steal the lasso gesture', () => {
    const controller = lassoToolSpec.createHandlers(
      createLassoEnvironment({
        getMeasuredNodes: () => [],
        getNodes: () => [],
        getEdges: () => [],
        beginGesture: vi.fn(),
        endGesture: vi.fn(),
        suppressNextSurfaceClick: vi.fn(),
        setPresence: vi.fn(),
      }),
    )
    const target = createPointerTarget()
    const pointerDown = createPointerEvent(target, { clientX: 0, clientY: 0 })
    const pointerMove = createPointerEvent(target, { clientX: 50, clientY: 50 })
    const pointerUp = createPointerEvent(target, { clientX: 50, clientY: 50 })

    controller.onPointerDown?.(pointerDown)
    controller.onPointerMove?.(pointerMove)
    controller.onPointerUp?.(pointerUp)

    expect(pointerDown.preventDefaultSpy).toHaveBeenCalledTimes(1)
    expect(pointerDown.stopPropagationSpy).toHaveBeenCalledTimes(1)
    expect(pointerMove.preventDefaultSpy).toHaveBeenCalledTimes(1)
    expect(pointerMove.stopPropagationSpy).toHaveBeenCalledTimes(1)
    expect(pointerUp.preventDefaultSpy).toHaveBeenCalledTimes(1)
    expect(pointerUp.stopPropagationSpy).toHaveBeenCalledTimes(1)
  })

  it('continues the active lasso gesture even if a later move has a stale buttons value', () => {
    const controller = lassoToolSpec.createHandlers(
      createLassoEnvironment({
        getMeasuredNodes: () => [createEmbedNode('inside-node', 20, 20)],
        getNodes: () => [createEmbedNode('inside-node', 20, 20)],
        getEdges: () => [],
        beginGesture: vi.fn(),
        endGesture: vi.fn(),
        suppressNextSurfaceClick: vi.fn(),
        setPresence: vi.fn(),
      }),
    )
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { buttons: 0, clientX: 100, clientY: 0 }))
    controller.onPointerMove?.(
      createPointerEvent(target, { buttons: 0, clientX: 100, clientY: 100 }),
    )

    expect(useLassoToolLocalOverlayStore.getState().points).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ])
  })

  it('clears selection when no measured nodes fall inside the lasso', () => {
    const clear = vi.fn()
    const controller = lassoToolSpec.createHandlers(
      createLassoEnvironment({
        getMeasuredNodes: () => [createEmbedNode('outside-node', 200, 200)],
        getNodes: () => [createEmbedNode('outside-node', 200, 200)],
        getEdges: () => [],
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

    expect(pendingPreview).toEqual({ nodeIds: new Set<string>(), edgeIds: new Set<string>() })
    expect(clear).not.toHaveBeenCalled()
  })

  it('clears selection on a point click without committing a lasso selection', () => {
    const clear = vi.fn()
    const endGesture = vi.fn()
    const controller = lassoToolSpec.createHandlers(
      createLassoEnvironment({
        getMeasuredNodes: () => [],
        getNodes: () => [],
        getEdges: () => [],
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
    expect(endGesture).toHaveBeenCalledTimes(1)
    expect(target.releasePointerCapture).toHaveBeenCalledWith(1)
  })

  it('selects nodes and edges when the lasso contacts them', () => {
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

    expect(pendingPreview).toEqual({
      nodeIds: new Set(['inside-node', 'contact-node']),
      edgeIds: new Set(['edge-1']),
    })
    expect(suppressNextSurfaceClick).toHaveBeenCalledTimes(1)
  })

  it('commits additive lasso selection when the primary modifier is held at gesture start', () => {
    const controller = lassoToolSpec.createHandlers(
      createLassoEnvironment({
        getMeasuredNodes: () => [createEmbedNode('inside-node', 20, 20)],
        getNodes: () => [createEmbedNode('inside-node', 20, 20)],
        getEdges: () => [],
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

    expect(pendingPreview).toEqual({
      nodeIds: new Set(['inside-node']),
      edgeIds: new Set<string>(),
    })
  })

  it('keeps already-selected items in the additive lasso preview', () => {
    const controller = lassoToolSpec.createHandlers(
      createLassoEnvironment({
        getMeasuredNodes: () => [createEmbedNode('inside-node', 20, 20)],
        getNodes: () => [createEmbedNode('inside-node', 20, 20)],
        getEdges: () => [],
        selectedNodeIds: new Set(['existing-node']),
        selectedEdgeIds: new Set(['existing-edge']),
        beginGesture: vi.fn(),
        endGesture: vi.fn(),
        suppressNextSurfaceClick: vi.fn(),
        setPresence: vi.fn(),
      }),
    )
    const target = createPointerTarget()

    drawRectangleLasso(controller, target, { ctrlKey: true })
    flushAnimationFrame()

    expect(pendingPreview).toEqual({
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
  beginGesture,
  endGesture,
  suppressNextSurfaceClick,
  setPresence,
  setActiveTool,
  clearSelection,
  selectedNodeIds = new Set<string>(),
  selectedEdgeIds = new Set<string>(),
}: {
  getMeasuredNodes: () => Array<CanvasMeasuredNode>
  getNodes: () => Array<Node>
  getEdges: () => Array<Edge>
  beginGesture: (kind: 'marquee' | 'lasso', mode?: string) => void
  endGesture: () => void
  suppressNextSurfaceClick: () => void
  setPresence: (namespace: string, value: unknown) => void
  setActiveTool?: (tool: CanvasToolId) => void
  clearSelection?: () => void
  selectedNodeIds?: ReadonlySet<string>
  selectedEdgeIds?: ReadonlySet<string>
}): CanvasToolRuntime {
  return {
    viewport: {
      screenToFlowPosition: ({ x, y }) => ({ x, y }),
      getZoom: () => 1,
    },
    commands: {
      createNode: () => undefined,
      patchNodeData: () => undefined,
      patchEdges: () => undefined,
      resizeNode: () => undefined,
      deleteNodes: () => undefined,
      createEdge: () => undefined,
      deleteEdges: () => undefined,
      setNodePositions: () => undefined,
    },
    query: {
      getNodes,
      getEdges,
      getMeasuredNodes,
    },
    selection: {
      getSnapshot: () => ({ nodeIds: selectedNodeIds, edgeIds: selectedEdgeIds }),
      setSelection: vi.fn(),
      clearSelection: clearSelection ?? vi.fn(),
      toggleNode: vi.fn(),
      toggleEdge: vi.fn(),
      beginGesture: (kind, mode) => beginGesture(kind, mode),
      setGesturePreview: vi.fn((preview: CanvasSelectionSnapshot | null) => {
        pendingPreview = preview
      }),
      commitGesture: vi.fn(),
      cancelGesture: endGesture,
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
