import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { clearCanvasDragSnapGuides } from '../canvas-drag-snap-overlay'
import { useCanvasNodeDragHandlers } from '../use-canvas-node-drag-handlers'
import { createCanvasEngine } from '../../../system/canvas-engine'

const modifierState = vi.hoisted(() => ({
  shiftPressed: false,
  primaryPressed: false,
}))
const dragState = vi.hoisted(() => ({
  currentNodes: [] as Array<any>,
}))

vi.mock('../use-canvas-modifier-keys', () => ({
  useCanvasModifierKeys: () => modifierState,
}))

describe('useCanvasNodeDragHandlers', () => {
  beforeEach(() => {
    dragState.currentNodes = []
    modifierState.shiftPressed = false
    modifierState.primaryPressed = false
    clearCanvasDragSnapGuides()
  })

  afterEach(() => {
    clearCanvasDragSnapGuides()
  })

  it('locks node dragging to the dominant axis while shift is held', () => {
    modifierState.shiftPressed = true
    dragState.currentNodes = [
      {
        id: 'dragged',
        type: 'text',
        position: { x: 10, y: 10 },
        width: 40,
        height: 40,
        data: {},
      },
    ]
    const viewport = createViewportMock()
    const canvasEngine = createCanvasEngine()
    canvasEngine.setDocumentSnapshot({ nodes: dragState.currentNodes })
    const awareness = {
      setLocalDragging: vi.fn(),
      setLocalCursor: vi.fn(),
      setLocalResizing: vi.fn(),
      setLocalSelection: vi.fn(),
    }
    const documentWriter = {
      setNodePositions: vi.fn(),
    }
    const selection = createSelectionMock(new Set(['dragged']))
    const { result } = renderHook(() =>
      useCanvasNodeDragHandlers({
        canvasEngine,
        documentWriter: documentWriter as never,
        nodesDoc: new Y.Doc(),
        remoteDragAnimation: {
          hasSpring: () => false,
          setTarget: () => undefined,
          clearNodeSprings: () => undefined,
        },
        awareness,
        interaction: { suppressNextSurfaceClick: vi.fn() },
        getFlowPosition: viewport.screenToCanvasPosition,
        getZoom: viewport.getZoom,
        selection,
        localDraggingIdsRef: { current: new Set<string>() },
        getShiftPressed: () => modifierState.shiftPressed,
        getPrimaryPressed: () => modifierState.primaryPressed,
      }),
    )

    result.current.profileDrag({
      nodeIds: new Set(['dragged']),
      delta: { x: 30, y: 12 },
      steps: 1,
    })

    expect(canvasEngine.getSnapshot().nodeLookup.get('dragged')?.node.position).toEqual({
      x: 40,
      y: 10,
    })
    expect(awareness.setLocalDragging).toHaveBeenCalledWith({
      dragged: { x: 40, y: 10 },
    })
  })

  it('snaps dragged nodes to nearby node edges when the primary modifier is held', () => {
    modifierState.primaryPressed = true
    dragState.currentNodes = [
      {
        id: 'dragged',
        type: 'text',
        position: { x: 10, y: 10 },
        width: 40,
        height: 40,
        data: {},
      },
      {
        id: 'target',
        type: 'text',
        position: { x: 80, y: 10 },
        width: 40,
        height: 40,
        data: {},
      },
    ]
    const viewport = createViewportMock()
    const canvasEngine = createCanvasEngine()
    canvasEngine.setDocumentSnapshot({ nodes: dragState.currentNodes })
    const documentWriter = {
      setNodePositions: vi.fn(),
    }
    const selection = createSelectionMock(new Set(['dragged']))
    const { result } = renderHook(() =>
      useCanvasNodeDragHandlers({
        canvasEngine,
        documentWriter: documentWriter as never,
        nodesDoc: new Y.Doc(),
        remoteDragAnimation: {
          hasSpring: () => false,
          setTarget: () => undefined,
          clearNodeSprings: () => undefined,
        },
        awareness: {
          setLocalDragging: vi.fn(),
          setLocalCursor: vi.fn(),
          setLocalResizing: vi.fn(),
          setLocalSelection: vi.fn(),
        },
        interaction: { suppressNextSurfaceClick: vi.fn() },
        getFlowPosition: viewport.screenToCanvasPosition,
        getZoom: viewport.getZoom,
        selection,
        localDraggingIdsRef: { current: new Set<string>() },
        getShiftPressed: () => modifierState.shiftPressed,
        getPrimaryPressed: () => modifierState.primaryPressed,
      }),
    )

    result.current.profileDrag({
      nodeIds: new Set(['dragged']),
      delta: { x: 31, y: 0 },
      steps: 1,
    })

    expect(canvasEngine.getSnapshot().nodeLookup.get('dragged')?.node.position.x).toBe(40)
    expect(documentWriter.setNodePositions).toHaveBeenCalledWith(
      new Map([['dragged', { x: 40, y: 10 }]]),
    )
  })

  it('commits engine drag positions before writing document positions', () => {
    dragState.currentNodes = [
      {
        id: 'dragged',
        type: 'text',
        position: { x: 10, y: 10 },
        width: 40,
        height: 40,
        data: {},
      },
    ]
    const viewport = createViewportMock()
    const canvasEngine = createCanvasEngine()
    canvasEngine.setDocumentSnapshot({ nodes: dragState.currentNodes })
    const documentWriter = {
      // These expectations verify engine state at the exact moment drag persistence is requested.
      setNodePositions: vi.fn(() => {
        expect(canvasEngine.getSnapshot().nodes[0]?.position).toEqual({ x: 35, y: 30 })
        expect(canvasEngine.getSnapshot().nodeLookup.get('dragged')?.dragging).toBe(false)
      }),
    }
    const suppressNextSurfaceClick = vi.fn()
    const selection = createSelectionMock(new Set(['dragged']))
    const { result } = renderHook(() =>
      useCanvasNodeDragHandlers({
        canvasEngine,
        documentWriter: documentWriter as never,
        nodesDoc: new Y.Doc(),
        remoteDragAnimation: {
          hasSpring: () => false,
          setTarget: () => undefined,
          clearNodeSprings: () => undefined,
        },
        awareness: {
          setLocalDragging: vi.fn(),
          setLocalCursor: vi.fn(),
          setLocalResizing: vi.fn(),
          setLocalSelection: vi.fn(),
        },
        interaction: { suppressNextSurfaceClick },
        getFlowPosition: viewport.screenToCanvasPosition,
        getZoom: viewport.getZoom,
        selection,
        localDraggingIdsRef: { current: new Set<string>() },
        getShiftPressed: () => modifierState.shiftPressed,
        getPrimaryPressed: () => modifierState.primaryPressed,
      }),
    )

    result.current.profileDrag({
      nodeIds: new Set(['dragged']),
      delta: { x: 25, y: 20 },
      steps: 1,
    })

    expect(documentWriter.setNodePositions).toHaveBeenCalledWith(
      new Map([['dragged', { x: 35, y: 30 }]]),
    )
    expect(suppressNextSurfaceClick).toHaveBeenCalledTimes(1)
  })
})

function createViewportMock() {
  return {
    screenToCanvasPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
    getZoom: () => 1,
  }
}

function createSelectionMock(nodeIds: ReadonlySet<string>) {
  return {
    getSnapshot: vi.fn(() => ({ nodeIds, edgeIds: new Set<string>() })),
    setSelection: vi.fn(),
    clearSelection: vi.fn(),
    toggleNode: vi.fn(),
    toggleEdge: vi.fn(),
    beginGesture: vi.fn(),
    setGesturePreview: vi.fn(),
    commitGesture: vi.fn(),
    cancelGesture: vi.fn(),
  }
}
