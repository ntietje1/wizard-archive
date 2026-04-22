import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasInteractionRuntime } from '../use-canvas-interaction-runtime'
import {
  createCanvasDocumentWriter,
  createCanvasRemoteDragAnimation,
  createCanvasSelectionController,
  createCanvasSessionRuntime,
} from '../../__tests__/canvas-runtime-test-utils'
import type { Edge, Node, ReactFlowInstance } from '@xyflow/react'
import type * as Y from 'yjs'
import { testId } from '~/test/helpers/test-id'

const previewSpy = vi.hoisted(() => vi.fn())
const dragHandlersSpy = vi.hoisted(() => vi.fn())
const cursorPresenceSpy = vi.hoisted(() => vi.fn())
const nodeActionsSpy = vi.hoisted(() => vi.fn())
const selectionRectSpy = vi.hoisted(() => vi.fn())
const selectionSyncSpy = vi.hoisted(() => vi.fn())
const toolRuntimeSpy = vi.hoisted(() => vi.fn())
const pointerBridgeSpy = vi.hoisted(() => vi.fn())
const wheelSpy = vi.hoisted(() => vi.fn())
const dropIntegrationSpy = vi.hoisted(() => vi.fn())
const flowHandlersSpy = vi.hoisted(() => vi.fn())
const surfaceClickGuardSpy = vi.hoisted(() => vi.fn())
const suppressNextSurfaceClick = vi.hoisted(() => vi.fn())

const dragHandlersMock = vi.hoisted(() => ({
  onNodeDragStart: vi.fn(),
  onNodeDrag: vi.fn(),
  onNodeDragStop: vi.fn(),
}))

const cursorPresenceMock = vi.hoisted(() => ({
  onMouseMove: vi.fn(),
  onMouseLeave: vi.fn(),
}))

const nodeActionsMock = vi.hoisted(() => ({
  updateNodeData: vi.fn(),
  transact: vi.fn(),
  onResize: vi.fn(),
  onResizeEnd: vi.fn(),
}))

const flowHandlersMock = vi.hoisted(
  () =>
    ({
      onNodeDragStart: vi.fn(),
      onNodeDrag: vi.fn(),
      onNodeDragStop: vi.fn(),
      onNodesDelete: vi.fn(),
      onEdgesDelete: vi.fn(),
      onConnect: vi.fn(),
      onMoveStart: vi.fn(),
      onMoveEnd: vi.fn(),
      onNodeClick: vi.fn(),
      onEdgeClick: vi.fn(),
      onPaneClick: vi.fn(),
      onMouseMove: vi.fn(),
      onMouseLeave: vi.fn(),
    }) as const,
)

vi.mock('~/features/previews/hooks/use-yjs-preview-upload', () => ({
  useYjsPreviewUpload: previewSpy,
}))

vi.mock('../use-canvas-node-drag-handlers', () => ({
  useCanvasNodeDragHandlers: (...args: Array<unknown>) => {
    dragHandlersSpy(...args)
    return dragHandlersMock
  },
}))

vi.mock('../use-canvas-cursor-presence', () => ({
  useCanvasCursorPresence: (...args: Array<unknown>) => {
    cursorPresenceSpy(...args)
    return cursorPresenceMock
  },
}))

vi.mock('../use-canvas-node-actions', () => ({
  useCanvasNodeActions: (...args: Array<unknown>) => {
    nodeActionsSpy(...args)
    return nodeActionsMock
  },
}))

vi.mock('../../selection/use-canvas-selection-rect', () => ({
  useCanvasSelectionRect: selectionRectSpy,
}))

vi.mock('../../selection/use-canvas-selection-sync', () => ({
  useCanvasSelectionSync: selectionSyncSpy,
}))

vi.mock('../use-canvas-tool-runtime', () => ({
  useCanvasToolRuntime: (...args: Array<unknown>) => {
    toolRuntimeSpy(...args)
    return {
      activeToolController: {
        onMoveStart: vi.fn(),
        onMoveEnd: vi.fn(),
        onNodeClick: vi.fn(),
        onEdgeClick: vi.fn(),
        onPaneClick: vi.fn(),
      },
      toolCursor: 'crosshair',
    }
  },
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
      dropOverlayRef: { current: null },
      isDropTarget: true,
      isFileDropTarget: false,
    }
  },
}))

vi.mock('../use-canvas-flow-handlers', () => ({
  useCanvasFlowHandlers: (...args: Array<unknown>) => {
    flowHandlersSpy(...args)
    return flowHandlersMock
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
  beforeEach(() => {
    previewSpy.mockReset()
    dragHandlersSpy.mockReset()
    cursorPresenceSpy.mockReset()
    nodeActionsSpy.mockReset()
    selectionRectSpy.mockReset()
    selectionSyncSpy.mockReset()
    toolRuntimeSpy.mockReset()
    pointerBridgeSpy.mockReset()
    wheelSpy.mockReset()
    dropIntegrationSpy.mockReset()
    flowHandlersSpy.mockReset()
    surfaceClickGuardSpy.mockReset()
  })

  it('owns the full interaction boundary instead of splitting shell and surface facades', () => {
    const reactFlowInstance = {
      getEdges: vi.fn(() => []),
      getNodes: vi.fn(() => []),
      getZoom: vi.fn(() => 1),
      setNodes: vi.fn(),
      screenToFlowPosition: vi.fn(({ x, y }: { x: number; y: number }) => ({ x, y })),
    } as unknown as ReactFlowInstance
    const selectionController = createCanvasSelectionController()
    const documentWriter = createCanvasDocumentWriter()
    const session = createCanvasSessionRuntime()
    const remoteDragAnimation = createCanvasRemoteDragAnimation()
    const nodesMap = {} as Y.Map<Node>
    const edgesMap = {} as Y.Map<Edge>
    const history = {
      canUndo: false,
      canRedo: false,
      undo: vi.fn(),
      redo: vi.fn(),
      onSelectionChange: vi.fn(),
    }

    const { result } = renderHook(() =>
      useCanvasInteractionRuntime({
        canvasId: testId<'sidebarItems'>('canvas-id'),
        campaignId: testId<'campaigns'>('campaign-id'),
        canvasParentId: testId<'sidebarItems'>('parent-id'),
        canEdit: true,
        activeToolId: 'select',
        doc: {} as Y.Doc,
        nodesMap,
        edgesMap,
        session,
        selectionController,
        documentWriter,
        history,
        localDraggingIdsRef: { current: new Set<string>() },
        remoteDragAnimation,
        reactFlowInstance,
      }),
    )

    expect(previewSpy).toHaveBeenCalledWith({
      itemId: 'canvas-id',
      doc: {},
      containerRef: expect.any(Object),
      resolveElement: expect.any(Function),
    })
    expect(dragHandlersSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        documentWriter,
        awareness: session.awareness.core,
        reactFlowInstance,
      }),
    )
    expect(cursorPresenceSpy).toHaveBeenCalledWith({
      reactFlowInstance,
      awareness: session.awareness.core,
    })
    expect(nodeActionsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        documentWriter,
        reactFlowInstance,
        session,
        transact: expect.any(Function),
      }),
    )
    expect(surfaceClickGuardSpy).toHaveBeenCalledWith(expect.any(Object))
    expect(selectionRectSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        interaction: {
          suppressNextSurfaceClick,
        },
        enabled: true,
      }),
    )
    expect(selectionSyncSpy).toHaveBeenCalledWith({
      setLocalSelection: session.awareness.core.setLocalSelection,
      onHistorySelectionChange: history.onSelectionChange,
    })
    expect(toolRuntimeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        interaction: {
          suppressNextSurfaceClick,
        },
        commands: documentWriter,
      }),
    )
    expect(pointerBridgeSpy).toHaveBeenCalled()
    expect(wheelSpy).toHaveBeenCalledWith(expect.any(Object))
    expect(dropIntegrationSpy).toHaveBeenCalledWith({
      canvasId: 'canvas-id',
      canEdit: true,
      isSelectMode: true,
      createNode: documentWriter.createNode,
      screenToFlowPosition: reactFlowInstance.screenToFlowPosition,
    })
    expect(flowHandlersSpy).toHaveBeenCalledWith({
      activeToolController: expect.any(Object),
      canEdit: true,
      cursorPresence: cursorPresenceMock,
      documentWriter,
      dragHandlers: dragHandlersMock,
      isSelectMode: true,
    })
    expect(result.current.nodeActions).toBe(nodeActionsMock)
    expect(result.current.shellProps).toEqual({
      chrome: {
        activeTool: 'select',
        dropTarget: {
          overlayRef: { current: null },
          isTarget: true,
          isFileTarget: false,
        },
        remoteUsers: [],
        toolCursor: 'crosshair',
      },
      canvasSurfaceRef: expect.any(Object),
      contextMenu: {
        campaignId: 'campaign-id',
        canvasParentId: 'parent-id',
        nodesMap: {},
        edgesMap: {},
        createNode: documentWriter.createNode,
        screenToFlowPosition: reactFlowInstance.screenToFlowPosition,
        selectionController,
      },
      flowHandlers: flowHandlersMock,
    })
  })

  it('treats non-select tools as non-selection mode even when editing is allowed', () => {
    renderHook(() =>
      useCanvasInteractionRuntime(createInteractionRuntimeOptions({ activeToolId: 'draw' })),
    )

    expect(selectionRectSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    )
    expect(dropIntegrationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        canEdit: true,
        isSelectMode: false,
      }),
    )
    expect(flowHandlersSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        canEdit: true,
        isSelectMode: false,
      }),
    )
  })

  it('disables selection editing behavior when the user cannot edit', () => {
    renderHook(() =>
      useCanvasInteractionRuntime(createInteractionRuntimeOptions({ canEdit: false })),
    )

    expect(selectionRectSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    )
    expect(dropIntegrationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        canEdit: false,
        isSelectMode: true,
      }),
    )
    expect(flowHandlersSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        canEdit: false,
        isSelectMode: true,
      }),
    )
  })
})

function createInteractionRuntimeOptions(
  overrides: Partial<Parameters<typeof useCanvasInteractionRuntime>[0]> = {},
): Parameters<typeof useCanvasInteractionRuntime>[0] {
  const session = createCanvasSessionRuntime()
  const selectionController = createCanvasSelectionController()
  const documentWriter = createCanvasDocumentWriter()
  const history = {
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
    onSelectionChange: vi.fn(),
  }
  const reactFlowInstance = {
    getNodes: vi.fn(() => []),
    getEdges: vi.fn(() => []),
    getZoom: vi.fn(() => 1),
    setNodes: vi.fn(),
    screenToFlowPosition: vi.fn(({ x, y }: { x: number; y: number }) => ({ x, y })),
  } as unknown as ReactFlowInstance

  return {
    canvasId: testId<'sidebarItems'>('canvas-id'),
    campaignId: testId<'campaigns'>('campaign-id'),
    canvasParentId: null,
    canEdit: true,
    activeToolId: 'select',
    doc: {} as Y.Doc,
    nodesMap: {} as Y.Map<Node>,
    edgesMap: {} as Y.Map<Edge>,
    session,
    selectionController,
    documentWriter,
    history,
    localDraggingIdsRef: { current: new Set<string>() },
    remoteDragAnimation: createCanvasRemoteDragAnimation(),
    reactFlowInstance,
    ...overrides,
  }
}
