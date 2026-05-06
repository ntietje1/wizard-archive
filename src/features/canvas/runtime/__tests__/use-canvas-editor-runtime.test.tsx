import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasEditorRuntime } from '../use-canvas-editor-runtime'
import { useCanvasToolStore } from '../../stores/canvas-tool-store'
import type { CanvasCommands } from '../document/use-canvas-commands'
import type { CanvasDocumentEdge, CanvasDocumentNode } from 'convex/canvases/validation'
import * as Y from 'yjs'
import { testId } from '~/test/helpers/test-id'

const previewSpy = vi.hoisted(() => vi.fn())
const projectionSpy = vi.hoisted(() => vi.fn())
const keyboardSpy = vi.hoisted(() => vi.fn())
const selectionControllerSpy = vi.hoisted(() => vi.fn())
const dragHandlersSpy = vi.hoisted(() => vi.fn())
const cursorPresenceSpy = vi.hoisted(() => vi.fn())
const nodeActionsSpy = vi.hoisted(() => vi.fn())
const pointerRouterSpy = vi.hoisted(() => vi.fn())
const viewportInteractionsSpy = vi.hoisted(() => vi.fn())
const dropIntegrationSpy = vi.hoisted(() => vi.fn())
const contextMenuSpy = vi.hoisted(() => vi.fn())
const toolHandlersSpy = vi.hoisted(() => vi.fn())
const clearToolTransientStateSpy = vi.hoisted(() => vi.fn())
const pointerRouterMock = vi.hoisted(() => ({
  interaction: {
    suppressNextSurfaceClick: vi.fn(),
  },
}))

const documentWriterMock = vi.hoisted(() => ({
  createNode: vi.fn(),
  patchNodeData: vi.fn(),
  patchEdges: vi.fn(),
  resizeNode: vi.fn(),
  resizeNodes: vi.fn(),
  deleteNodes: vi.fn(),
  createEdge: vi.fn(),
  deleteEdges: vi.fn(),
  setNodePositions: vi.fn(),
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
  clearSelection: vi.fn(),
  getSelectedNodeIds: vi.fn(() => new Set<string>()),
  getSelectedEdgeIds: vi.fn(() => new Set<string>()),
  setGesturePreview: vi.fn(),
  toggleNodeFromTarget: vi.fn(),
  toggleEdgeFromTarget: vi.fn(),
  toggleNode: vi.fn(),
  toggleEdge: vi.fn(),
  beginGesture: vi.fn(),
  commitGestureSelection: vi.fn(),
  commitGesture: vi.fn(),
  endGesture: vi.fn(),
  cancelGesture: vi.fn(),
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
  destroy: vi.fn(),
  handlePointerDown: vi.fn(),
  profileDrag: vi.fn(),
}))
const cursorPresenceMock = vi.hoisted(() => ({
  onMouseMove: vi.fn(),
  onMouseLeave: vi.fn(),
}))
const nodeActionsMock = vi.hoisted(() => ({
  transact: vi.fn(),
  onResize: vi.fn(),
  onResizeEnd: vi.fn(),
  onResizeMany: vi.fn(),
  onResizeManyCancel: vi.fn(),
  onResizeManyEnd: vi.fn(),
}))
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
    }) as const,
)
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
      setLocalResizing: vi.fn(),
      setLocalSelection: vi.fn(),
    },
    presence: {
      setPresence: vi.fn(),
    },
  },
  remoteUsers: [],
  remoteResizeDimensions: {},
  remoteHighlights: new Map(),
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
  useCanvasDocumentCommands: () => commandsMock,
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

vi.mock('../interaction/use-canvas-pointer-router', () => ({
  useCanvasPointerRouterController: () => pointerRouterMock,
  useCanvasPointerRouter: pointerRouterSpy,
}))

vi.mock('../interaction/use-canvas-viewport-interactions', () => ({
  useCanvasViewportInteractions: viewportInteractionsSpy,
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

vi.mock('../context-menu/use-canvas-context-menu', () => ({
  useCanvasContextMenu: (...args: Array<unknown>) => {
    contextMenuSpy(...args)
    return contextMenuMock
  },
}))

vi.mock('../session/use-canvas-session-state', () => ({
  useCanvasSessionState: () => session,
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

function createTestCanvasDoc() {
  const doc = new Y.Doc()
  return {
    doc,
    nodesMap: doc.getMap<CanvasDocumentNode>('nodes'),
    edgesMap: doc.getMap<CanvasDocumentEdge>('edges'),
  }
}

describe('useCanvasEditorRuntime', () => {
  beforeEach(() => {
    useCanvasToolStore.getState().reset()
    previewSpy.mockReset()
    projectionSpy.mockReset()
    keyboardSpy.mockReset()
    selectionControllerSpy.mockReset()
    dragHandlersSpy.mockReset()
    cursorPresenceSpy.mockReset()
    nodeActionsSpy.mockReset()
    pointerRouterSpy.mockReset()
    viewportInteractionsSpy.mockReset()
    dropIntegrationSpy.mockReset()
    contextMenuSpy.mockReset()
    toolHandlersSpy.mockReset()
    clearToolTransientStateSpy.mockReset()
    selectionControllerMock.clear.mockReset()
    selectionControllerMock.clearSelection.mockReset()
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
      useCanvasEditorRuntime({
        nodesMap,
        edgesMap,
        canvasId: testId<'sidebarItems'>('canvas-id'),
        campaignId: testId<'campaigns'>('campaign-id'),
        canvasParentId: testId<'sidebarItems'>('parent-id'),
        canEdit: true,
        provider: null,
        doc,
        initialViewport: { x: 0, y: 0, zoom: 1 },
      }),
    )

    expect(previewSpy).toHaveBeenCalledWith({
      itemId: 'canvas-id',
      doc,
      containerRef: expect.any(Object),
      resolveElement: expect.any(Function),
    })
    expect(projectionSpy).toHaveBeenCalledWith({
      canvasEngine: expect.objectContaining({
        getSnapshot: expect.any(Function),
        setDocumentSnapshot: expect.any(Function),
      }),
      nodesMap,
      edgesMap,
      localDraggingIdsRef: expect.any(Object),
      remoteResizeDimensions: session.remoteResizeDimensions,
    })
    expect(selectionControllerSpy).toHaveBeenCalledWith({
      canvasEngine: expect.objectContaining({
        getSnapshot: expect.any(Function),
      }),
      onSelectionChange: expect.any(Function),
      setLocalSelection: session.awareness.core.setLocalSelection,
    })
    expect(keyboardSpy).toHaveBeenCalledWith({
      undo: historyMock.undo,
      redo: historyMock.redo,
      canEdit: true,
      nodesMap,
      edgesMap,
      selection: selectionControllerMock,
      commands: commandsMock,
    })
    expect(nodeActionsSpy).toHaveBeenCalledWith({
      canvasEngine: expect.objectContaining({
        getSnapshot: expect.any(Function),
      }),
      documentWriter: documentWriterMock,
      session,
      transact: expect.any(Function),
    })
    expect(pointerRouterSpy).toHaveBeenCalledWith({
      router: pointerRouterMock,
      surfaceRef: expect.any(Object),
      options: expect.objectContaining({
        activeTool: 'select',
        activeToolHandlers: toolHandlersMock,
        awareness: session.awareness.presence,
        canvasEngine: expect.objectContaining({
          getSnapshot: expect.any(Function),
        }),
        enabled: true,
        getShiftPressed: expect.any(Function),
        selection: selectionControllerMock,
        viewportController: expect.objectContaining({
          getZoom: expect.any(Function),
          screenToCanvasPosition: expect.any(Function),
        }),
      }),
    })
    expect(viewportInteractionsSpy).toHaveBeenCalledWith({
      ref: expect.objectContaining({ current: null }),
      viewportController: expect.objectContaining({ handleWheel: expect.any(Function) }),
      canPrimaryPan: expect.any(Function),
    })
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
      setPendingEditNodeId: session.editSession.setPendingEditNodeId,
      setPendingEditNodePoint: session.editSession.setPendingEditNodePoint,
      screenToCanvasPosition: expect.any(Function),
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
        sceneHandlers: expect.objectContaining({
          createEdgeFromConnection: expect.any(Function),
          onMouseMove: cursorPresenceMock.onMouseMove,
          onMouseLeave: cursorPresenceMock.onMouseLeave,
        }),
        history: historyMock,
        nodeActions: nodeActionsMock,
        viewportController: expect.objectContaining({
          getZoom: expect.any(Function),
          screenToCanvasPosition: expect.any(Function),
        }),
        remoteHighlights: session.remoteHighlights,
        remoteUsers: session.remoteUsers,
        selection: selectionControllerMock,
        toolCursor: undefined,
      }),
    )

    unmount()
    doc.destroy()

    expect(clearToolTransientStateSpy).toHaveBeenCalledWith('select-overlay')
    expect(clearToolTransientStateSpy).toHaveBeenCalledWith(
      'select-awareness',
      session.awareness.presence,
    )
  })

  it('clears the previous tool transient state when the active tool changes', () => {
    const { doc, nodesMap, edgesMap } = createTestCanvasDoc()
    const { rerender } = renderHook(() =>
      useCanvasEditorRuntime({
        nodesMap,
        edgesMap,
        canvasId: testId<'sidebarItems'>('canvas-id'),
        campaignId: testId<'campaigns'>('campaign-id'),
        canvasParentId: null,
        canEdit: true,
        provider: null,
        doc,
        initialViewport: { x: 0, y: 0, zoom: 1 },
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
    expect(selectionControllerMock.clearSelection).toHaveBeenCalledTimes(1)
    expect(session.editSession.setEditingEmbedId).toHaveBeenCalledWith(null)
    expect(session.editSession.setPendingEditNodeId).toHaveBeenCalledWith(null)
    expect(session.editSession.setPendingEditNodePoint).toHaveBeenCalledWith(null)

    doc.destroy()
  })

  it('keeps selection state when switching to a selection-compatible tool', () => {
    const { doc, nodesMap, edgesMap } = createTestCanvasDoc()
    const { rerender } = renderHook(() =>
      useCanvasEditorRuntime({
        nodesMap,
        edgesMap,
        canvasId: testId<'sidebarItems'>('canvas-id'),
        campaignId: testId<'campaigns'>('campaign-id'),
        canvasParentId: null,
        canEdit: true,
        provider: null,
        doc,
        initialViewport: { x: 0, y: 0, zoom: 1 },
      }),
    )

    act(() => {
      useCanvasToolStore.getState().setActiveTool('hand')
    })

    rerender()

    expect(selectionControllerMock.clearSelection).not.toHaveBeenCalled()
    expect(session.editSession.setEditingEmbedId).not.toHaveBeenCalled()
    expect(session.editSession.setPendingEditNodeId).not.toHaveBeenCalled()
    expect(session.editSession.setPendingEditNodePoint).not.toHaveBeenCalled()

    doc.destroy()
  })
})
