import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCanvasDocumentRuntime } from '../use-canvas-document-runtime'
import type { CanvasRemoteDragAnimation } from '../../interaction/use-canvas-remote-drag-animation'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'

const documentWriterMock = vi.hoisted(() => ({
  createNode: vi.fn(),
  updateNode: vi.fn(),
  updateNodeData: vi.fn(),
  resizeNode: vi.fn(),
  deleteNodes: vi.fn(),
  createEdge: vi.fn(),
  deleteEdges: vi.fn(),
  setNodePosition: vi.fn(),
}))

const historyMock = vi.hoisted(() => ({
  canUndo: false,
  canRedo: false,
  undo: vi.fn(),
  redo: vi.fn(),
  onSelectionChange: vi.fn(),
}))

const projectionSpy = vi.hoisted(() => vi.fn())
const keyboardSpy = vi.hoisted(() => vi.fn())

vi.mock('../use-canvas-document-writer', () => ({
  useCanvasDocumentWriter: () => documentWriterMock,
}))

vi.mock('../use-canvas-document-projection', () => ({
  useCanvasDocumentProjection: projectionSpy,
}))

vi.mock('../use-canvas-history', () => ({
  useCanvasHistory: () => historyMock,
}))

vi.mock('../use-canvas-keyboard-shortcuts', () => ({
  useCanvasKeyboardShortcuts: keyboardSpy,
}))

describe('useCanvasDocumentRuntime', () => {
  it('wires projection, history, and keyboard shortcuts around the shared document writer', () => {
    const localDraggingIdsRef = { current: new Set<string>() }
    const remoteDragAnimation: CanvasRemoteDragAnimation = {
      hasSpring: () => false,
      setTarget: () => undefined,
      clearNodeSprings: () => undefined,
    }
    const nodesMap = {} as Y.Map<Node>
    const edgesMap = {} as Y.Map<Edge>
    const selection = { replace: vi.fn(), clear: vi.fn() }

    const { result } = renderHook(() =>
      useCanvasDocumentRuntime({
        canEdit: true,
        nodesMap,
        edgesMap,
        selection,
        localDraggingIdsRef,
        remoteResizeDimensions: {},
        remoteDragAnimation,
      }),
    )

    expect(projectionSpy).toHaveBeenCalledWith({
      nodesMap,
      edgesMap,
      localDraggingIdsRef,
      remoteResizeDimensions: {},
      remoteDragAnimation,
    })
    expect(keyboardSpy).toHaveBeenCalledWith({
      ...historyMock,
      canEdit: true,
      nodesMap,
      edgesMap,
      selection,
    })
    expect(result.current.documentWriter).toBe(documentWriterMock)
    expect(result.current.history).toBe(historyMock)
  })
})
