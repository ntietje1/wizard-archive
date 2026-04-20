import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasToolRuntime } from '../use-canvas-tool-runtime'
import { useCanvasToolStore } from '../../../stores/canvas-tool-store'
import type { CanvasEditSessionState } from '../../../tools/canvas-tool-types'

const reactFlowMock = vi.hoisted(() => ({
  screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
  getZoom: () => 1,
}))

const storeApiMock = vi.hoisted(() => ({
  getState: () => ({
    nodeLookup: new Map(),
  }),
}))

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => reactFlowMock,
  useStoreApi: () => storeApiMock,
}))

function createAwarenessMock() {
  return {
    core: {
      setLocalCursor: vi.fn(),
      setLocalDragging: vi.fn(),
      setLocalResizing: vi.fn(),
      setLocalSelection: vi.fn(),
    },
    presence: {
      setPresence: vi.fn(),
    },
  }
}

describe('useCanvasToolRuntime', () => {
  beforeEach(() => {
    useCanvasToolStore.getState().reset()
    useCanvasToolStore.getState().setActiveTool('lasso')
  })

  it('keeps the active lasso controller stable across rerenders', () => {
    const documentWriter = {
      createNode: vi.fn(),
      updateNode: vi.fn(),
      updateNodeData: vi.fn(),
      resizeNode: vi.fn(),
      deleteNodes: vi.fn(),
      createEdge: vi.fn(),
      deleteEdges: vi.fn(),
      setNodePosition: vi.fn(),
    }
    const documentReader = {
      getNodes: vi.fn(() => []),
      getEdges: vi.fn(() => []),
    }
    const selectionActions = {
      replace: vi.fn(),
      replaceNodes: vi.fn(),
      replaceEdges: vi.fn(),
      clear: vi.fn(),
      getSelectedNodeIds: vi.fn(() => []),
      getSelectedEdgeIds: vi.fn(() => []),
      toggleNodeFromTarget: vi.fn(),
      toggleEdgeFromTarget: vi.fn(),
      beginGesture: vi.fn(),
      commitGestureSelection: vi.fn(),
      endGesture: vi.fn(),
    }
    const interaction = {
      suppressNextSurfaceClick: vi.fn(),
    }
    const editSession: CanvasEditSessionState = {
      editingEmbedId: null,
      setEditingEmbedId: vi.fn(),
      pendingEditNodeId: null,
      setPendingEditNodeId: vi.fn(),
    }

    const { result, rerender } = renderHook(
      ({ awareness }) =>
        useCanvasToolRuntime({
          documentRead: documentReader,
          documentWrite: documentWriter,
          selection: selectionActions,
          interaction,
          awareness,
          editSession,
        }),
      {
        initialProps: {
          awareness: createAwarenessMock(),
        },
      },
    )

    const initialController = result.current.activeToolController

    rerender({
      awareness: createAwarenessMock(),
    })

    expect(result.current.activeTool).toBe('lasso')
    expect(result.current.toolCursor).toBe('crosshair')
    expect(result.current.activeToolController).toBe(initialController)
    expect('activeToolModule' in result.current).toBe(false)
  })
})
