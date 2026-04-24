import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasFlowRuntime } from '../use-canvas-flow-runtime'
import { useCanvasToolStore } from '../../stores/canvas-tool-store'
import type { Edge, Node, ReactFlowInstance } from '@xyflow/react'
import type { CanvasCommands } from '../document/use-canvas-commands'
import * as Y from 'yjs'
import { testId } from '~/test/helpers/test-id'

const previewSpy = vi.hoisted(() => vi.fn())
const projectionSpy = vi.hoisted(() => vi.fn())
const keyboardSpy = vi.hoisted(() => vi.fn())
const selectionControllerSpy = vi.hoisted(() => vi.fn())
const dragHandlersSpy = vi.hoisted(() => vi.fn())
const cursorPresenceSpy = vi.hoisted(() => vi.fn())
const nodeActionsSpy = vi.hoisted(() => vi.fn())
const selectionRectSpy = vi.hoisted(() => vi.fn())
const pointerBridgeSpy = vi.hoisted(() => vi.fn())
const wheelSpy = vi.hoisted(() => vi.fn())
const dropIntegrationSpy = vi.hoisted(() => vi.fn())
const flowHandlersSpy = vi.hoisted(() => vi.fn())
const contextMenuSpy = vi.hoisted(() => vi.fn())
const surfaceClickGuardSpy = vi.hoisted(() => vi.fn())
const toolHandlersSpy = vi.hoisted(() => vi.fn())
const clearSelectionSpy = vi.hoisted(() => vi.fn())
const clearToolTransientStateSpy = vi.hoisted(() => vi.fn())
const cancelConnectionSpy = vi.hoisted(() => vi.fn())

const documentWriterMock = vi.hoisted(() => ({
  createNode: vi.fn(),
  updateNode: vi.fn(),
  updateNodeData: vi.fn(),
  updateEdge: vi.fn(),
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
const selectionControllerMock = vi.hoisted(() => ({
  getSnapshot: vi.fn(() => ({ nodeIds: new Set<string>(), edgeIds: new Set<string>() })),
  replace: vi.fn(),
  replaceNodes: vi.fn(),
  replaceEdges: vi.fn(),
  clear: vi.fn(),
  getSelectedNodeIds: vi.fn(() => new Set<string>()),
  getSelectedEdgeIds: vi.fn(() => new Set<string>()),
  toggleNodeFromTarget: vi.fn(),
  toggleEdgeFromTarget: vi.fn(),
  beginGesture: vi.fn(),
  commitGestureSelection: vi.fn(),
  endGesture: vi.fn(),
}))
const commandsMock = vi.hoisted(
  (): Pick<CanvasCommands, 'copy' | 'cut' | 'paste' | 'duplicate' | 'delete' | 'reorder'> => ({
    copy: { id: 'copy', canRun: vi.fn(() => true), run: vi.fn(() => true) },
    cut: { id: 'cut', canRun: vi.fn(() => true), run: vi.fn(() => true) },
    paste: { id: 'paste', canRun: vi.fn(() => false), run: vi.fn(() => null) },
    duplicate: { id: 'duplicate', canRun: vi.fn(() => true), run: vi.fn(() => null) },
    delete: { id: 'delete', canRun: vi.fn(() => true), run: vi.fn(() => true) },
    reorder: { id: 'reorder', canRun: vi.fn(() => true), run: vi.fn(() => true) },
  }),
)
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
const contextMenuMock = vi.hoisted(
  () =>
    ({
      close: vi.fn(),
      hostRef: { current: null },
      menu: { groups: [], flatItems: [], isEmpty: true },
      onClose: vi.fn(),
      openForEdge: vi.fn(),
      openForNode: vi.fn(),
      openForPane: vi.fn(),
    }) as const,
)
const toolHandlersMock = vi.hoisted(
  () =>
    ({
      onMoveStart: vi.fn(),
      onMoveEnd: vi.fn(),
      onNodeClick: vi.fn(),
      onEdgeClick: vi.fn(),
      onPaneClick: vi.fn(),
    }) as const,
)
const reactFlowMock = vi.hoisted(
  () =>
    ({
      getEdges: vi.fn(() => []),
      getNodes: vi.fn(() => []),
      getZoom: vi.fn(() => 1),
      setEdges: vi.fn(),
      setNodes: vi.fn(),
      screenToFlowPosition: vi.fn(({ x, y }: { x: number; y: number }) => ({ x, y })),
    }) as unknown as ReactFlowInstance,
)
const storeApiMock = vi.hoisted(() => ({
  getState: () => ({
    cancelConnection: cancelConnectionSpy,
    nodeLookup: new Map(),
  }),
  setState: vi.fn(),
}))
const session = vi.hoisted(() => ({
  editSession: {
    editingEmbedId: null,
    setEditingEmbedId: vi.fn(),
    pendingEditNodeId: null,
    pendingEditNodePoint: null,
    setPendingEditNodeId: vi.fn(),
    setPendingEditNodePoint: vi.fn(),
  },
  awareness: {
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
  },
  remoteUsers: [],
  remoteDragPositions: {},
  remoteResizeDimensions: {},
  remoteHighlights: new Map(),
}))
const remoteDragAnimation = vi.hoisted(() => ({
  hasSpring: vi.fn(() => false),
  setTarget: vi.fn(),
  clearNodeSprings: vi.fn(),
}))

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => reactFlowMock,
  useStoreApi: () => storeApiMock,
}))

vi.mock('~/features/previews/hooks/use-yjs-preview-upload', () => ({
  useYjsPreviewUpload: previewSpy,
}))

vi.mock('../document/use-canvas-document-writer', () => ({
  createCanvasDocumentWriter: () => documentWriterMock,
}))

vi.mock('../document/use-canvas-document-projection', () => ({
  useCanvasDocumentProjection: projectionSpy,
}))

vi.mock('../document/use-canvas-history', () => ({
  useCanvasHistory: () => historyMock,
}))

vi.mock('../document/use-canvas-keyboard-shortcuts', () => ({
  useCanvasKeyboardShortcuts: keyboardSpy,
}))

vi.mock('../document/use-canvas-commands', () => ({
  useCanvasCommands: () => commandsMock,
}))

vi.mock('../selection/use-canvas-selection-actions', () => ({
  useCanvasSelectionController: (...args: Array<unknown>) => {
    selectionControllerSpy(...args)
    return selectionControllerMock
  },
}))

vi.mock('../interaction/use-canvas-node-drag-handlers', () => ({
  useCanvasNodeDragHandlers: (...args: Array<unknown>) => {
    dragHandlersSpy(...args)
    return dragHandlersMock
  },
}))

vi.mock('../interaction/use-canvas-cursor-presence', () => ({
  useCanvasCursorPresence: (...args: Array<unknown>) => {
    cursorPresenceSpy(...args)
    return cursorPresenceMock
  },
}))

vi.mock('../interaction/create-canvas-node-actions', () => ({
  createCanvasNodeActions: (...args: Array<unknown>) => {
    nodeActionsSpy(...args)
    return nodeActionsMock
  },
}))

vi.mock('../selection/use-canvas-selection-rect', () => ({
  useCanvasSelectionRect: selectionRectSpy,
}))

vi.mock('../interaction/use-canvas-pointer-bridge', () => ({
  useCanvasPointerBridge: pointerBridgeSpy,
}))

vi.mock('../interaction/use-canvas-wheel', () => ({
  useCanvasWheel: wheelSpy,
}))

vi.mock('../interaction/use-canvas-drop-integration', () => ({
  useCanvasDropIntegration: (...args: Array<unknown>) => {
    dropIntegrationSpy(...args)
    return {
      dropOverlayRef: { current: null },
      isDropTarget: true,
      isFileDropTarget: false,
    }
  },
}))

vi.mock('../interaction/use-canvas-flow-handlers', () => ({
  createCanvasFlowHandlers: (...args: Array<unknown>) => {
    flowHandlersSpy(...args)
    return flowHandlersMock
  },
}))

vi.mock('../context-menu/use-canvas-context-menu', () => ({
  useCanvasContextMenu: (...args: Array<unknown>) => {
    contextMenuSpy(...args)
    return contextMenuMock
  },
}))

vi.mock('../interaction/use-canvas-surface-click-guard', () => ({
  useCanvasSurfaceClickGuard: (...args: Array<unknown>) => {
    surfaceClickGuardSpy(...args)
    return {
      suppressNextSurfaceClick: vi.fn(),
    }
  },
}))

vi.mock('../session/use-canvas-session-state', () => ({
  useCanvasSessionState: () => session,
}))

vi.mock('../interaction/use-canvas-remote-drag-animation', () => ({
  useCanvasRemoteDragAnimation: () => remoteDragAnimation,
}))

vi.mock('../interaction/use-canvas-modifier-keys', () => ({
  useCanvasModifierKeys: () => ({
    shiftPressed: false,
    primaryPressed: false,
  }),
}))

vi.mock('../../tools/canvas-tool-modules', () => ({
  canvasToolSpecs: {
    select: {
      cursor: undefined,
      createHandlers: (runtime: unknown) => {
        toolHandlersSpy('select', runtime)
        return toolHandlersMock
      },
      localOverlay: { clear: () => clearToolTransientStateSpy('select-overlay') },
      awareness: {
        clear: (presence: unknown) => clearToolTransientStateSpy('select-awareness', presence),
      },
    },
    hand: {
      cursor: undefined,
      createHandlers: (runtime: unknown) => {
        toolHandlersSpy('hand', runtime)
        return toolHandlersMock
      },
    },
    lasso: {
      cursor: 'crosshair',
      createHandlers: (runtime: unknown) => {
        toolHandlersSpy('lasso', runtime)
        return toolHandlersMock
      },
    },
    draw: {
      cursor: 'crosshair',
      createHandlers: (runtime: unknown) => {
        toolHandlersSpy('draw', runtime)
        return toolHandlersMock
      },
      localOverlay: { clear: () => clearToolTransientStateSpy('draw-overlay') },
      awareness: {
        clear: (presence: unknown) => clearToolTransientStateSpy('draw-awareness', presence),
      },
    },
    erase: {
      cursor: undefined,
      createHandlers: (runtime: unknown) => {
        toolHandlersSpy('erase', runtime)
        return toolHandlersMock
      },
    },
    text: {
      cursor: undefined,
      createHandlers: (runtime: unknown) => {
        toolHandlersSpy('text', runtime)
        return toolHandlersMock
      },
    },
    edge: {
      cursor: undefined,
      createHandlers: (runtime: unknown) => {
        toolHandlersSpy('edge', runtime)
        return toolHandlersMock
      },
    },
  },
}))

vi.mock('../selection/use-canvas-selection-state', () => ({
  clearCanvasSelectionState: clearSelectionSpy,
}))

function createTestCanvasDoc() {
  const doc = new Y.Doc()
  return {
    doc,
    nodesMap: doc.getMap<Node>('nodes'),
    edgesMap: doc.getMap<Edge>('edges'),
  }
}

describe('useCanvasFlowRuntime', () => {
  beforeEach(() => {
    useCanvasToolStore.getState().reset()
    previewSpy.mockReset()
    projectionSpy.mockReset()
    keyboardSpy.mockReset()
    selectionControllerSpy.mockReset()
    dragHandlersSpy.mockReset()
    cursorPresenceSpy.mockReset()
    nodeActionsSpy.mockReset()
    selectionRectSpy.mockReset()
    pointerBridgeSpy.mockReset()
    wheelSpy.mockReset()
    dropIntegrationSpy.mockReset()
    flowHandlersSpy.mockReset()
    contextMenuSpy.mockReset()
    surfaceClickGuardSpy.mockReset()
    toolHandlersSpy.mockReset()
    clearSelectionSpy.mockReset()
    clearToolTransientStateSpy.mockReset()
    cancelConnectionSpy.mockReset()
    storeApiMock.setState.mockReset()
    selectionControllerMock.clear.mockReset()
    session.editSession.setEditingEmbedId.mockReset()
    session.editSession.setPendingEditNodeId.mockReset()
    session.editSession.setPendingEditNodePoint.mockReset()
  })

  afterEach(() => {
    useCanvasToolStore.getState().reset()
  })

  it('owns the merged canvas runtime boundary and returns the direct runtime state', () => {
    const { doc, nodesMap, edgesMap } = createTestCanvasDoc()

    const { result, unmount } = renderHook(() =>
      useCanvasFlowRuntime({
        nodesMap,
        edgesMap,
        canvasId: testId<'sidebarItems'>('canvas-id'),
        campaignId: testId<'campaigns'>('campaign-id'),
        canvasParentId: testId<'sidebarItems'>('parent-id'),
        canEdit: true,
        provider: null,
        doc,
      }),
    )

    expect(previewSpy).toHaveBeenCalledWith({
      itemId: 'canvas-id',
      doc,
      containerRef: expect.any(Object),
      resolveElement: expect.any(Function),
    })
    expect(projectionSpy).toHaveBeenCalledWith({
      nodesMap,
      edgesMap,
      localDraggingIdsRef: expect.any(Object),
      remoteResizeDimensions: session.remoteResizeDimensions,
      remoteDragAnimation,
    })
    expect(selectionControllerSpy).toHaveBeenCalledWith({
      onSelectionChange: expect.any(Function),
      setLocalSelection: session.awareness.core.setLocalSelection,
    })
    expect(keyboardSpy).toHaveBeenCalledWith({
      undo: historyMock.undo,
      redo: historyMock.redo,
      cancelConnectionDraft: expect.any(Function),
      canEdit: true,
      nodesMap,
      edgesMap,
      selection: selectionControllerMock,
      commands: commandsMock,
    })
    expect(nodeActionsSpy).toHaveBeenCalledWith({
      documentWriter: documentWriterMock,
      reactFlowInstance: reactFlowMock,
      session,
      transact: expect.any(Function),
    })
    expect(selectionRectSpy).toHaveBeenCalledWith({
      surfaceRef: expect.any(Object),
      awareness: session.awareness.presence,
      selection: selectionControllerMock,
      interaction: expect.objectContaining({
        suppressNextSurfaceClick: expect.any(Function),
      }),
      enabled: true,
    })
    expect(pointerBridgeSpy).toHaveBeenCalledWith({
      surfaceRef: expect.any(Object),
      activeToolHandlers: toolHandlersMock,
    })
    expect(wheelSpy).toHaveBeenCalledWith(expect.objectContaining({ current: null }))
    expect(toolHandlersSpy).toHaveBeenCalledWith(
      'select',
      expect.objectContaining({
        awareness: session.awareness,
        commands: documentWriterMock,
        selection: selectionControllerMock,
      }),
    )
    expect(contextMenuSpy).toHaveBeenCalledWith({
      activeTool: 'select',
      canEdit: true,
      campaignId: 'campaign-id',
      canvasParentId: 'parent-id',
      nodesMap,
      edgesMap,
      createNode: documentWriterMock.createNode,
      screenToFlowPosition: reactFlowMock.screenToFlowPosition,
      selection: selectionControllerMock,
      commands: commandsMock,
    })
    expect(result.current).toEqual(
      expect.objectContaining({
        activeTool: 'select',
        commands: commandsMock,
        contextMenu: contextMenuMock,
        documentWriter: documentWriterMock,
        dropTarget: {
          dropOverlayRef: { current: null },
          isDropTarget: true,
          isFileDropTarget: false,
        },
        editSession: session.editSession,
        flowHandlers: flowHandlersMock,
        history: historyMock,
        nodeActions: nodeActionsMock,
        remoteHighlights: session.remoteHighlights,
        remoteUsers: session.remoteUsers,
        selection: selectionControllerMock,
        toolCursor: undefined,
      }),
    )

    unmount()
    doc.destroy()

    expect(clearSelectionSpy).toHaveBeenCalledTimes(1)
    expect(clearToolTransientStateSpy).toHaveBeenCalledWith('select-overlay')
    expect(clearToolTransientStateSpy).toHaveBeenCalledWith(
      'select-awareness',
      session.awareness.presence,
    )
  })

  it('clears the previous tool transient state when the active tool changes', () => {
    const { doc, nodesMap, edgesMap } = createTestCanvasDoc()
    const { rerender } = renderHook(() =>
      useCanvasFlowRuntime({
        nodesMap,
        edgesMap,
        canvasId: testId<'sidebarItems'>('canvas-id'),
        campaignId: testId<'campaigns'>('campaign-id'),
        canvasParentId: null,
        canEdit: true,
        provider: null,
        doc,
      }),
    )

    act(() => {
      useCanvasToolStore.getState().setActiveTool('draw')
    })

    rerender()

    expect(clearToolTransientStateSpy).toHaveBeenCalledWith('select-overlay')
    expect(clearToolTransientStateSpy).toHaveBeenCalledWith(
      'select-awareness',
      session.awareness.presence,
    )
    expect(toolHandlersSpy).toHaveBeenCalledWith('draw', expect.any(Object))
    expect(cancelConnectionSpy).toHaveBeenCalledTimes(1)
    expect(storeApiMock.setState).toHaveBeenCalledWith({ connectionClickStartHandle: null })
    expect(selectionControllerMock.clear).toHaveBeenCalledTimes(1)
    expect(session.editSession.setEditingEmbedId).toHaveBeenCalledWith(null)
    expect(session.editSession.setPendingEditNodeId).toHaveBeenCalledWith(null)
    expect(session.editSession.setPendingEditNodePoint).toHaveBeenCalledWith(null)

    doc.destroy()
  })

  it('keeps selection state when switching to a selection-compatible tool', () => {
    const { doc, nodesMap, edgesMap } = createTestCanvasDoc()
    const { rerender } = renderHook(() =>
      useCanvasFlowRuntime({
        nodesMap,
        edgesMap,
        canvasId: testId<'sidebarItems'>('canvas-id'),
        campaignId: testId<'campaigns'>('campaign-id'),
        canvasParentId: null,
        canEdit: true,
        provider: null,
        doc,
      }),
    )

    act(() => {
      useCanvasToolStore.getState().setActiveTool('hand')
    })

    rerender()

    expect(cancelConnectionSpy).toHaveBeenCalledTimes(1)
    expect(storeApiMock.setState).toHaveBeenCalledWith({ connectionClickStartHandle: null })
    expect(selectionControllerMock.clear).not.toHaveBeenCalled()
    expect(session.editSession.setEditingEmbedId).not.toHaveBeenCalled()
    expect(session.editSession.setPendingEditNodeId).not.toHaveBeenCalled()
    expect(session.editSession.setPendingEditNodePoint).not.toHaveBeenCalled()

    doc.destroy()
  })
})
