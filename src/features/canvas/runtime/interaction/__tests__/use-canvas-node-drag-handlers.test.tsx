import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import {
  clearCanvasDragSnapGuides,
  useCanvasDragSnapOverlayStore,
} from '../canvas-drag-snap-overlay'
import { useCanvasNodeDragHandlers } from '../use-canvas-node-drag-handlers'

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
    const reactFlowInstance = createReactFlowMock()
    const awareness = {
      setLocalDragging: vi.fn(),
      setLocalCursor: vi.fn(),
      setLocalResizing: vi.fn(),
      setLocalSelection: vi.fn(),
    }
    const documentWriter = {
      setNodePosition: vi.fn(),
    }
    const { result } = renderHook(() =>
      useCanvasNodeDragHandlers({
        documentWriter: documentWriter as never,
        nodesDoc: new Y.Doc(),
        remoteDragAnimation: {
          hasSpring: () => false,
          setTarget: () => undefined,
          clearNodeSprings: () => undefined,
        },
        awareness,
        reactFlowInstance: reactFlowInstance as never,
        localDraggingIdsRef: { current: new Set<string>() },
      }),
    )

    result.current.onNodeDragStart?.(
      createMouseEvent(10, 10),
      dragState.currentNodes[0],
      dragState.currentNodes as never,
    )
    result.current.onNodeDrag?.(
      createMouseEvent(40, 22),
      dragState.currentNodes[0],
      dragState.currentNodes as never,
    )

    expect(dragState.currentNodes[0].position).toEqual({ x: 40, y: 10 })
    expect(awareness.setLocalDragging).toHaveBeenCalledWith({
      dragged: { x: 40, y: 10 },
    })
  })

  it('snaps dragged nodes to nearby node edges and publishes guides when the primary modifier is held', () => {
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
    const reactFlowInstance = createReactFlowMock()
    const documentWriter = {
      setNodePosition: vi.fn(),
    }
    const { result } = renderHook(() =>
      useCanvasNodeDragHandlers({
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
        reactFlowInstance: reactFlowInstance as never,
        localDraggingIdsRef: { current: new Set<string>() },
      }),
    )

    result.current.onNodeDragStart?.(createMouseEvent(10, 10), dragState.currentNodes[0], [
      dragState.currentNodes[0],
    ] as never)
    result.current.onNodeDrag?.(createMouseEvent(41, 10), dragState.currentNodes[0], [
      dragState.currentNodes[0],
    ] as never)

    expect(dragState.currentNodes[0].position.x).toBe(40)
    expect(useCanvasDragSnapOverlayStore.getState().guides).toContainEqual(
      expect.objectContaining({ orientation: 'vertical', position: 80 }),
    )

    result.current.onNodeDragStop?.(createMouseEvent(41, 10), dragState.currentNodes[0], [
      dragState.currentNodes[0],
    ] as never)

    expect(documentWriter.setNodePosition).toHaveBeenCalledWith('dragged', { x: 40, y: 10 })
  })
})

function createReactFlowMock() {
  return {
    screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
    getZoom: () => 1,
    getNodes: () => dragState.currentNodes,
    setNodes: (updater: (nodes: Array<any>) => Array<any>) => {
      dragState.currentNodes = updater(dragState.currentNodes)
    },
  }
}

function createMouseEvent(clientX: number, clientY: number) {
  return {
    clientX,
    clientY,
    pointerId: 1,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    nativeEvent: {
      stopImmediatePropagation: vi.fn(),
    },
    isDefaultPrevented: () => false,
    isPropagationStopped: () => false,
    persist: () => undefined,
  } as unknown as React.MouseEvent
}
