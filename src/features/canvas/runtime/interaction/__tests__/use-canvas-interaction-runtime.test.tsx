import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCanvasInteractionRuntime } from '../use-canvas-interaction-runtime'
import type { CanvasRemoteDragAnimation } from '../use-canvas-remote-drag-animation'
import type { CanvasSessionRuntime } from '../../session/use-canvas-session-state'
import type { CanvasSelectionController } from '../../../tools/canvas-tool-types'
import type * as Y from 'yjs'

const reactFlowMock = vi.hoisted(() => ({
  getNodes: vi.fn(() => []),
  getEdges: vi.fn(() => []),
  getZoom: vi.fn(() => 1),
  screenToFlowPosition: vi.fn(({ x, y }: { x: number; y: number }) => ({ x, y })),
}))

const selectionRectSpy = vi.hoisted(() => vi.fn())
const selectionSyncSpy = vi.hoisted(() => vi.fn())
const previewSpy = vi.hoisted(() => vi.fn())
const pointerBridgeSpy = vi.hoisted(() => vi.fn())
const wheelSpy = vi.hoisted(() => vi.fn())
const dropIntegrationSpy = vi.hoisted(() => vi.fn())
const dragHandlersSpy = vi.hoisted(() => vi.fn())
const cursorPresenceSpy = vi.hoisted(() => vi.fn())
const toolRuntimeSpy = vi.hoisted(() => vi.fn())
const surfaceClickGuardSpy = vi.hoisted(() => vi.fn())
const suppressNextSurfaceClick = vi.hoisted(() => vi.fn())

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => reactFlowMock,
}))

vi.mock('../../selection/use-canvas-selection-rect', () => ({
  useCanvasSelectionRect: selectionRectSpy,
}))

vi.mock('../../selection/use-canvas-selection-sync', () => ({
  useCanvasSelectionSync: selectionSyncSpy,
}))

vi.mock('~/features/previews/hooks/use-canvas-preview', () => ({
  useCanvasPreview: previewSpy,
}))

vi.mock('../use-canvas-pointer-bridge', () => ({
  useCanvasPointerBridge: pointerBridgeSpy,
}))

vi.mock('../use-canvas-wheel', () => ({
  useCanvasWheel: wheelSpy,
}))

vi.mock('../use-canvas-drop-integration', () => ({
  useCanvasDropIntegration: (...args: Array<unknown>) => {
    dropIntegrationSpy(...args)
    return {
      dropOverlayRef: vi.fn(),
      isDropTarget: true,
      isFileDropTarget: false,
    }
  },
}))

vi.mock('../use-canvas-node-drag-handlers', () => ({
  useCanvasNodeDragHandlers: (...args: Array<unknown>) => {
    dragHandlersSpy(...args)
    return {
      onNodeDragStart: vi.fn(),
      onNodeDrag: vi.fn(),
      onNodeDragStop: vi.fn(),
    }
  },
}))

vi.mock('../use-canvas-cursor-presence', () => ({
  useCanvasCursorPresence: (...args: Array<unknown>) => {
    cursorPresenceSpy(...args)
    return {
      onMouseMove: vi.fn(),
      onMouseLeave: vi.fn(),
    }
  },
}))

vi.mock('../use-canvas-tool-runtime', () => ({
  useCanvasToolRuntime: (...args: Array<unknown>) => {
    toolRuntimeSpy(...args)
    return {
      activeTool: 'select',
      toolCursor: 'crosshair',
      activeToolController: {
        onMoveStart: vi.fn(),
        onMoveEnd: vi.fn(),
        onNodeClick: vi.fn(),
        onEdgeClick: vi.fn(),
        onPaneClick: vi.fn(),
      },
    }
  },
}))

vi.mock('../use-canvas-surface-click-guard', () => ({
  useCanvasSurfaceClickGuard: (...args: Array<unknown>) => {
    surfaceClickGuardSpy(...args)
    return {
      suppressNextSurfaceClick,
    }
  },
}))

describe('useCanvasInteractionRuntime', () => {
  it('composes shell wiring and node actions around the thinner runtime dependencies', () => {
    const awareness = {
      remoteUsers: [],
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
    const session: CanvasSessionRuntime = {
      editSession: {
        editingEmbedId: null,
        setEditingEmbedId: vi.fn(),
        pendingEditNodeId: null,
        setPendingEditNodeId: vi.fn(),
      },
      awareness,
      remoteUsers: [],
      remoteDragPositions: {},
      remoteResizeDimensions: {},
      remoteHighlights: new Map(),
    }
    const selectionController: CanvasSelectionController = {
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
    const history = {
      canUndo: false,
      canRedo: false,
      undo: vi.fn(),
      redo: vi.fn(),
      onSelectionChange: vi.fn(),
    }
    const canvasSurfaceRef = { current: document.createElement('div') }
    const localDraggingIdsRef = { current: new Set<string>() }
    const remoteDragAnimation: CanvasRemoteDragAnimation = {
      hasSpring: () => false,
      setTarget: () => undefined,
      clearNodeSprings: () => undefined,
    }

    const { result } = renderHook(() =>
      useCanvasInteractionRuntime({
        canvasId: 'canvas-id' as never,
        canEdit: true,
        activeToolId: 'select',
        doc: {} as Y.Doc,
        nodesMap: {} as Y.Map<any>,
        edgesMap: {} as Y.Map<any>,
        canvasSurfaceRef,
        session,
        selectionController,
        documentWriter,
        history,
        localDraggingIdsRef,
        remoteDragAnimation,
      }),
    )

    expect(selectionRectSpy).toHaveBeenCalled()
    expect(selectionRectSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        interaction: {
          suppressNextSurfaceClick,
        },
      }),
    )
    expect(selectionSyncSpy).toHaveBeenCalledWith({
      setLocalSelection: awareness.core.setLocalSelection,
      onHistorySelectionChange: history.onSelectionChange,
    })
    expect(toolRuntimeSpy).toHaveBeenCalled()
    expect(toolRuntimeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        interaction: {
          suppressNextSurfaceClick,
        },
      }),
    )
    expect(previewSpy).toHaveBeenCalled()
    expect(pointerBridgeSpy).toHaveBeenCalled()
    expect(wheelSpy).toHaveBeenCalledWith(canvasSurfaceRef)
    expect(dropIntegrationSpy).toHaveBeenCalled()
    expect(dragHandlersSpy).toHaveBeenCalled()
    expect(cursorPresenceSpy).toHaveBeenCalled()
    expect(surfaceClickGuardSpy).toHaveBeenCalledWith(canvasSurfaceRef)
    expect(result.current.shellProps.toolCursor).toBe('crosshair')
    expect(result.current.shellProps.activeTool).toBe('select')

    result.current.nodeActions.onResize('node-1', 120, 80, { x: 10, y: 20 })
    expect(awareness.core.setLocalResizing).toHaveBeenCalledWith({
      'node-1': { width: 120, height: 80, x: 10, y: 20 },
    })

    result.current.nodeActions.onResizeEnd('node-1', 120, 80, { x: 10, y: 20 })
    expect(awareness.core.setLocalResizing).toHaveBeenLastCalledWith(null)
    expect(documentWriter.resizeNode).toHaveBeenCalledWith('node-1', 120, 80, { x: 10, y: 20 })
  })
})
