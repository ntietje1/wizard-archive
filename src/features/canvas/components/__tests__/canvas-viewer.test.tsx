import { render, screen } from '@testing-library/react'
import { forwardRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasEditor } from '../canvas-viewer'
import type { CanvasEdge, CanvasNode } from '../../types/canvas-domain-types'
import * as Y from 'yjs'
import { testId } from '~/test/helpers/test-id'

const sceneMock = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}))

const runtimeMock = vi.hoisted(() => ({
  activeTool: 'select' as 'select' | 'edge',
  canvasEngine: {
    getSnapshot: () => ({ viewport: { x: 0, y: 0, zoom: 1 } }),
    subscribe: () => () => undefined,
  },
  canvasSurfaceRef: { current: null },
  contextMenu: {
    close: vi.fn(),
    hostRef: { current: null },
    menu: { groups: [], flatItems: [], isEmpty: true },
    onClose: vi.fn(),
    openForEdge: vi.fn(),
    openForNode: vi.fn(),
    openForPane: vi.fn(),
  },
  commands: {
    copy: { id: 'copy', canRun: vi.fn(() => true), run: vi.fn(() => true) },
    cut: { id: 'cut', canRun: vi.fn(() => true), run: vi.fn(() => true) },
    paste: { id: 'paste', canRun: vi.fn(() => false), run: vi.fn(() => null) },
    duplicate: { id: 'duplicate', canRun: vi.fn(() => true), run: vi.fn(() => null) },
    delete: { id: 'delete', canRun: vi.fn(() => true), run: vi.fn(() => true) },
    reorder: { id: 'reorder', canRun: vi.fn(() => true), run: vi.fn(() => true) },
  },
  documentWriter: {
    createNode: vi.fn(),
    patchNodeData: vi.fn(),
    patchEdges: vi.fn(),
    resizeNode: vi.fn(),
    resizeNodes: vi.fn(),
    deleteNodes: vi.fn(),
    createEdge: vi.fn(),
    deleteEdges: vi.fn(),
    setNodePositions: vi.fn(),
  },
  domRuntime: {
    flushRenderScheduler: vi.fn(),
    registerEdgeElement: vi.fn(() => vi.fn()),
    registerEdgePaths: vi.fn(() => vi.fn()),
    registerNodeElement: vi.fn(() => vi.fn()),
    registerNodeSurfaceElement: vi.fn(() => vi.fn()),
    registerStrokeNodePaths: vi.fn(() => vi.fn()),
    registerViewportElement: vi.fn(() => vi.fn()),
    registerViewportOverlayElement: vi.fn(() => vi.fn()),
    scheduleCameraState: vi.fn(),
    scheduleEdgePatches: vi.fn(),
    scheduleNodeDataPatches: vi.fn(),
    scheduleViewportTransform: vi.fn(),
  },
  dropTarget: {
    dropOverlayRef: { current: null },
    isDropTarget: false,
    isFileDropTarget: false,
  },
  editSession: {
    editingEmbedId: null,
    setEditingEmbedId: vi.fn(),
    pendingEditNodeId: null,
    pendingEditNodePoint: null,
    setPendingEditNodeId: vi.fn(),
    setPendingEditNodePoint: vi.fn(),
  },
  sceneHandlers: {
    onMouseMove: vi.fn(),
    onMouseLeave: vi.fn(),
  },
  history: {
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
  },
  nodeActions: {
    transact: vi.fn(),
    onResize: vi.fn(),
    onResizeEnd: vi.fn(),
    onResizeMany: vi.fn(),
    onResizeManyCancel: vi.fn(),
    onResizeManyEnd: vi.fn(),
  },
  nodeDragController: null,
  viewportController: {
    getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
    getZoom: vi.fn(() => 1),
    screenToCanvasPosition: vi.fn(({ x, y }: { x: number; y: number }) => ({ x, y })),
    canvasToScreenPosition: vi.fn(({ x, y }: { x: number; y: number }) => ({ x, y })),
    handleWheel: vi.fn(),
    handlePanPointerDown: vi.fn(),
    panBy: vi.fn(),
    zoomBy: vi.fn(),
    zoomTo: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitView: vi.fn(),
    syncFromDocumentOrAdapter: vi.fn(),
    commit: vi.fn(),
    destroy: vi.fn(),
  },
  remoteHighlights: new Map(),
  remoteUsers: [],
  selection: {
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
  },
  toolCursor: undefined as string | undefined,
}))

vi.mock('../../runtime/use-canvas-editor-runtime', () => ({
  useCanvasEditorRuntime: () => runtimeMock,
}))

vi.mock('../../runtime/providers/canvas-runtime-context', () => ({
  CanvasRuntimeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('../canvas-toolbar', () => ({
  CanvasToolbar: () => null,
}))

vi.mock('../canvas-conditional-toolbar', () => ({
  CanvasConditionalToolbar: () => null,
}))

vi.mock('../canvas-local-overlays-host', () => ({
  CanvasLocalOverlaysHost: () => null,
}))

vi.mock('../canvas-awareness-host', () => ({
  CanvasAwarenessHost: () => null,
}))

vi.mock('../canvas-scene', () => ({
  CanvasScene: (props: Record<string, unknown>) => {
    sceneMock.props = props
    return <div data-testid="canvas-scene" />
  },
}))

vi.mock('~/features/context-menu/components/context-menu-host', () => ({
  ContextMenuHost: forwardRef((_props, _ref) => null),
}))

vi.mock('../../runtime/selection/use-canvas-pending-selection-preview', () => ({
  useCanvasPendingSelectionPreviewSummary: () => ({
    active: false,
    nodeCount: 0,
    edgeCount: 0,
  }),
}))

vi.mock('../../runtime/interaction/canvas-viewport-storage', () => ({
  loadPersistedCanvasViewport: () => ({
    x: 120,
    y: -45,
    zoom: 1.5,
  }),
}))

vi.mock('~/features/dnd/stores/dnd-store', () => ({
  useDndStore: (
    selector: (state: { isDraggingElement: boolean; isDraggingFiles: boolean }) => boolean,
  ) => selector({ isDraggingElement: false, isDraggingFiles: false }),
}))

describe('CanvasEditor', () => {
  beforeEach(() => {
    sceneMock.props = null
  })

  afterEach(() => {
    runtimeMock.activeTool = 'select'
    runtimeMock.toolCursor = undefined
  })

  it('renders the internal canvas scene with the canvas-owned runtime', () => {
    const doc = new Y.Doc()
    const props: Parameters<typeof CanvasEditor>[0] = {
      status: 'ready',
      canvasId: testId<'sidebarItems'>('canvas-1'),
      campaignId: testId<'campaigns'>('campaign-1'),
      canEdit: true,
      colorMode: 'light',
      parentId: null,
      provider: null,
      user: { name: 'Test User', color: '#61afef' },
      doc,
      nodesMap: doc.getMap<CanvasNode>('nodes'),
      edgesMap: doc.getMap<CanvasEdge>('edges'),
    }

    render(<CanvasEditor {...props} />)

    expect(screen.getByTestId('canvas-scene')).toBeInTheDocument()
    expect(sceneMock.props).toEqual(
      expect.objectContaining({
        canEdit: true,
        remoteUsers: runtimeMock.remoteUsers,
        sceneHandlers: runtimeMock.sceneHandlers,
        onNodeContextMenu: runtimeMock.contextMenu.openForNode,
        onEdgeContextMenu: runtimeMock.contextMenu.openForEdge,
        onPaneContextMenu: runtimeMock.contextMenu.openForPane,
      }),
    )
    expect(screen.getByTestId('canvas-editor-shell')).toHaveStyle({ cursor: 'pointer' })

    doc.destroy()
  })

  it('uses the active tool cursor from the runtime', () => {
    runtimeMock.activeTool = 'edge'
    runtimeMock.toolCursor = 'crosshair'
    const doc = new Y.Doc()

    render(
      <CanvasEditor
        status="ready"
        canvasId={testId<'sidebarItems'>('canvas-1')}
        campaignId={testId<'campaigns'>('campaign-1')}
        canEdit
        colorMode="light"
        parentId={null}
        provider={null}
        user={{ name: 'Test User', color: '#61afef' }}
        doc={doc}
        nodesMap={doc.getMap<CanvasNode>('nodes')}
        edgesMap={doc.getMap<CanvasEdge>('edges')}
      />,
    )

    expect(screen.getByTestId('canvas-scene')).toBeInTheDocument()
    expect(sceneMock.props?.sceneHandlers).toBe(runtimeMock.sceneHandlers)
    expect(screen.getByTestId('canvas-editor-shell')).toHaveStyle({ cursor: 'crosshair' })

    doc.destroy()
  })
})
