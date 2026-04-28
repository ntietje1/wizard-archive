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
        awareness,
        interaction: { suppressNextSurfaceClick: vi.fn() },
        getCanvasPosition: viewport.screenToCanvasPosition,
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
    expect(awareness.setLocalCursor).toHaveBeenCalledWith({ x: 130, y: 112 })
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
        awareness: {
          setLocalCursor: vi.fn(),
          setLocalResizing: vi.fn(),
          setLocalSelection: vi.fn(),
        },
        interaction: { suppressNextSurfaceClick: vi.fn() },
        getCanvasPosition: viewport.screenToCanvasPosition,
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
        awareness: {
          setLocalCursor: vi.fn(),
          setLocalResizing: vi.fn(),
          setLocalSelection: vi.fn(),
        },
        interaction: { suppressNextSurfaceClick },
        getCanvasPosition: viewport.screenToCanvasPosition,
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

  it('ignores move, commit, and cancel events from a different pointer', () => {
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
      setNodePositions: vi.fn(),
    }
    const selection = createSelectionMock(new Set(['dragged']))
    const localDraggingIdsRef = { current: new Set<string>() }
    const { result } = renderHook(() =>
      useCanvasNodeDragHandlers({
        canvasEngine,
        documentWriter: documentWriter as never,
        nodesDoc: new Y.Doc(),
        awareness: {
          setLocalCursor: vi.fn(),
          setLocalResizing: vi.fn(),
          setLocalSelection: vi.fn(),
        },
        interaction: { suppressNextSurfaceClick: vi.fn() },
        getCanvasPosition: viewport.screenToCanvasPosition,
        getZoom: viewport.getZoom,
        selection,
        localDraggingIdsRef,
        getShiftPressed: () => modifierState.shiftPressed,
        getPrimaryPressed: () => modifierState.primaryPressed,
      }),
    )

    expect(result.current.begin('dragged', createPointerEvent('pointerdown', 1, 100, 100))).toBe(
      true,
    )
    expect(result.current.update(createPointerEvent('pointermove', 2, 140, 140))).toBe(false)
    expect(result.current.commit(createPointerEvent('pointerup', 2, 140, 140))).toBe(false)
    expect(result.current.cancel(createPointerEvent('pointercancel', 2, 140, 140))).toBe(false)

    expect(canvasEngine.getSnapshot().nodeLookup.get('dragged')?.node.position).toEqual({
      x: 10,
      y: 10,
    })
    expect(documentWriter.setNodePositions).not.toHaveBeenCalled()

    expect(result.current.update(createPointerEvent('pointermove', 1, 140, 140))).toBe(true)
    expect(result.current.commit(createPointerEvent('pointerup', 1, 140, 140))).toBe(true)

    expect(documentWriter.setNodePositions).toHaveBeenCalledWith(
      new Map([['dragged', { x: 50, y: 50 }]]),
    )
  })

  it('cancels active pointer drags without persisting document positions', () => {
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
      setNodePositions: vi.fn(),
    }
    const selection = createSelectionMock(new Set(['dragged']))
    const localDraggingIdsRef = { current: new Set<string>() }
    const { result } = renderHook(() =>
      useCanvasNodeDragHandlers({
        canvasEngine,
        documentWriter: documentWriter as never,
        nodesDoc: new Y.Doc(),
        awareness: {
          setLocalCursor: vi.fn(),
          setLocalResizing: vi.fn(),
          setLocalSelection: vi.fn(),
        },
        interaction: { suppressNextSurfaceClick: vi.fn() },
        getCanvasPosition: viewport.screenToCanvasPosition,
        getZoom: viewport.getZoom,
        selection,
        localDraggingIdsRef,
        getShiftPressed: () => modifierState.shiftPressed,
        getPrimaryPressed: () => modifierState.primaryPressed,
      }),
    )

    expect(result.current.begin('dragged', createPointerEvent('pointerdown', 1, 100, 100))).toBe(
      true,
    )
    expect(result.current.update(createPointerEvent('pointermove', 1, 140, 140))).toBe(true)
    expect(localDraggingIdsRef.current.has('dragged')).toBe(true)

    expect(result.current.cancel(createPointerEvent('pointercancel', 1, 140, 140))).toBe(true)

    expect(canvasEngine.getSnapshot().nodeLookup.get('dragged')?.node.position).toEqual({
      x: 10,
      y: 10,
    })
    expect(canvasEngine.getSnapshot().nodeLookup.get('dragged')?.dragging).toBe(false)
    expect(localDraggingIdsRef.current.has('dragged')).toBe(false)
    expect(documentWriter.setNodePositions).not.toHaveBeenCalled()
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

function createPointerEvent(type: string, pointerId: number, clientX: number, clientY: number) {
  return new PointerEvent(type, {
    bubbles: true,
    button: 0,
    clientX,
    clientY,
    pointerId,
  })
}
