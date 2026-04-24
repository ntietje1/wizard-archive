import { render } from '@testing-library/react'
import { forwardRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasFlow } from '../canvas-viewer'
import type { Edge, Node } from '@xyflow/react'
import * as Y from 'yjs'
import { testId } from '~/test/helpers/test-id'

const reactFlowMock = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}))

const runtimeMock = vi.hoisted(() => ({
  activeTool: 'select' as 'select' | 'edge',
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
    updateNode: vi.fn(),
    updateNodeData: vi.fn(),
    updateEdge: vi.fn(),
    resizeNode: vi.fn(),
    deleteNodes: vi.fn(),
    createEdge: vi.fn(),
    deleteEdges: vi.fn(),
    setNodePosition: vi.fn(),
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
  flowHandlers: {
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
    updateNodeData: vi.fn(),
    transact: vi.fn(),
    onResize: vi.fn(),
    onResizeEnd: vi.fn(),
  },
  remoteHighlights: new Map(),
  remoteUsers: [],
  selection: {
    getSnapshot: vi.fn(() => ({ nodeIds: [], edgeIds: [] })),
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
  },
  toolCursor: undefined,
}))

vi.mock('@xyflow/react', () => ({
  Background: () => null,
  Handle: () => null,
  MiniMap: () => null,
  getBezierPath: ({
    sourceX,
    sourceY,
    targetX,
    targetY,
  }: {
    sourceX: number
    sourceY: number
    targetX: number
    targetY: number
  }) => [
    `M ${sourceX},${sourceY} C ${sourceX},${sourceY} ${targetX},${targetY} ${targetX},${targetY}`,
    (sourceX + targetX) / 2,
    (sourceY + targetY) / 2,
  ],
  useReactFlow: () => ({
    screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
  }),
  Position: {
    Top: 'top',
    Right: 'right',
    Bottom: 'bottom',
    Left: 'left',
  },
  ReactFlow: (props: Record<string, unknown>) => {
    reactFlowMock.props = props
    return <div data-testid="react-flow">{props.children as React.ReactNode}</div>
  },
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => children,
  ConnectionMode: {
    Loose: 'loose',
  },
  SelectionMode: {
    Partial: 'partial',
  },
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

vi.mock('../../runtime/use-canvas-flow-runtime', () => ({
  useCanvasFlowRuntime: () => runtimeMock,
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

vi.mock('~/features/context-menu/components/context-menu-host', () => ({
  ContextMenuHost: forwardRef((_props, _ref) => null),
}))

vi.mock('../../runtime/interaction/canvas-viewport-persistence', () => ({
  CanvasViewportPersistence: () => null,
}))

vi.mock('../canvas-minimap-node', () => ({
  MiniMapNode: () => null,
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

describe('CanvasFlow', () => {
  beforeEach(() => {
    reactFlowMock.props = null
  })

  afterEach(() => {
    runtimeMock.activeTool = 'select'
  })

  it('renders the React Flow surface with the canvas-owned defaults', () => {
    const doc = new Y.Doc()
    const props: Parameters<typeof CanvasFlow>[0] = {
      status: 'ready',
      canvasId: testId<'sidebarItems'>('canvas-1'),
      campaignId: testId<'campaigns'>('campaign-1'),
      canEdit: true,
      colorMode: 'light',
      parentId: null,
      provider: null,
      user: { name: 'Test User', color: '#61afef' },
      doc,
      nodesMap: doc.getMap<Node>('nodes'),
      edgesMap: doc.getMap<Edge>('edges'),
    }

    render(<CanvasFlow {...props} />)

    expect(reactFlowMock.props?.zoomOnDoubleClick).toBe(false)
    expect(reactFlowMock.props?.connectionMode).toBe('loose')
    expect(reactFlowMock.props?.connectionLineComponent).toEqual(expect.any(Function))
    expect(reactFlowMock.props?.edgeTypes).toEqual(
      expect.objectContaining({
        bezier: expect.any(Function),
      }),
    )
    expect(reactFlowMock.props?.nodesConnectable).toBe(false)
    expect(reactFlowMock.props?.connectOnClick).toBe(false)
    expect(reactFlowMock.props?.elevateNodesOnSelect).toBe(false)
    expect(reactFlowMock.props?.elevateEdgesOnSelect).toBe(false)
    expect(reactFlowMock.props?.defaultViewport).toEqual({
      x: 120,
      y: -45,
      zoom: 1.5,
    })
    expect(reactFlowMock.props?.deleteKeyCode).toEqual([])

    doc.destroy()
  })

  it('enables drag edge creation only while the edge tool is active', () => {
    runtimeMock.activeTool = 'edge'
    const doc = new Y.Doc()

    render(
      <CanvasFlow
        status="ready"
        canvasId={testId<'sidebarItems'>('canvas-1')}
        campaignId={testId<'campaigns'>('campaign-1')}
        canEdit
        colorMode="light"
        parentId={null}
        provider={null}
        user={{ name: 'Test User', color: '#61afef' }}
        doc={doc}
        nodesMap={doc.getMap<Node>('nodes')}
        edgesMap={doc.getMap<Edge>('edges')}
      />,
    )

    expect(reactFlowMock.props?.nodesConnectable).toBe(true)
    expect(reactFlowMock.props?.connectOnClick).toBe(false)

    doc.destroy()
  })
})
