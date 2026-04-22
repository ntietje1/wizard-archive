import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCanvasFlowController } from '../use-canvas-flow-controller'
import type { CanvasFlowShellProps } from '../../components/canvas-flow-shell'
import type { Id } from 'convex/_generated/dataModel'
import type { CanvasRemoteDragAnimation } from '../interaction/use-canvas-remote-drag-animation'
import type { CanvasSessionRuntime } from '../session/use-canvas-session-state'
import type { Edge, Node, ReactFlowInstance } from '@xyflow/react'
import type * as Y from 'yjs'
import { testId } from '~/test/helpers/test-id'

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

const nodeActionsMock = vi.hoisted(() => ({
  updateNodeData: vi.fn(),
  transact: vi.fn(),
  onResize: vi.fn(),
  onResizeEnd: vi.fn(),
}))

type CanvasFlowRuntimeShellProps = Omit<CanvasFlowShellProps, 'viewportPersistence'>

const shellPropsMock = vi.hoisted(
  () =>
    ({
      chrome: {
        activeTool: 'select',
        remoteUsers: [],
        dropTarget: {
          overlayRef: { current: null },
          isTarget: false,
          isFileTarget: false,
        },
        toolCursor: 'crosshair',
      },
      canvasSurfaceRef: { current: null },
      contextMenu: {
        campaignId: 'campaign-id' as Id<'campaigns'>,
        canvasParentId: null,
        nodesMap: {} as Y.Map<Node>,
        edgesMap: {} as Y.Map<Edge>,
        createNode: vi.fn(),
        screenToFlowPosition: vi.fn(({ x, y }: { x: number; y: number }) => ({ x, y })),
        selectionController: {
          replace: vi.fn(),
          clear: vi.fn(),
        },
      },
      flowHandlers: {
        onMoveStart: vi.fn(),
        onMoveEnd: vi.fn(),
        onNodeClick: vi.fn(),
        onEdgeClick: vi.fn(),
        onPaneClick: vi.fn(),
        onMouseMove: vi.fn(),
        onMouseLeave: vi.fn(),
      },
    }) satisfies CanvasFlowRuntimeShellProps,
)

const projectionSpy = vi.hoisted(() => vi.fn())
const keyboardSpy = vi.hoisted(() => vi.fn())
const interactionRuntimeSpy = vi.hoisted(() => vi.fn())
const clearSelectionSpy = vi.hoisted(() => vi.fn())
const reactFlowMock = vi.hoisted(
  () =>
    ({
      getNodes: vi.fn(() => []),
      getEdges: vi.fn(() => []),
      getZoom: vi.fn(() => 1),
      setNodes: vi.fn(),
      screenToFlowPosition: vi.fn(({ x, y }: { x: number; y: number }) => ({ x, y })),
    }) as unknown as ReactFlowInstance,
)

const selectionController = vi.hoisted(() => ({
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
}))

const remoteDragAnimation: CanvasRemoteDragAnimation = {
  hasSpring: () => false,
  setTarget: () => undefined,
  clearNodeSprings: () => undefined,
}

const session: CanvasSessionRuntime = {
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
}

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => reactFlowMock,
}))

vi.mock('../document/use-canvas-document-writer', () => ({
  useCanvasDocumentWriter: () => documentWriterMock,
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

vi.mock('../interaction/use-canvas-interaction-runtime', () => ({
  useCanvasInteractionRuntime: (...args: Array<unknown>) => {
    interactionRuntimeSpy(...args)
    return {
      shellProps: shellPropsMock,
      nodeActions: nodeActionsMock,
    }
  },
}))

vi.mock('../interaction/use-canvas-remote-drag-animation', () => ({
  useCanvasRemoteDragAnimation: () => remoteDragAnimation,
}))

vi.mock('../selection/use-canvas-selection-actions', () => ({
  useCanvasSelectionActions: () => selectionController,
}))

vi.mock('../selection/use-canvas-selection-state', () => ({
  clearCanvasSelectionState: clearSelectionSpy,
}))

vi.mock('../session/use-canvas-session-state', () => ({
  useCanvasSessionState: () => session,
}))

vi.mock('../../stores/canvas-tool-store', () => ({
  useCanvasToolStore: (selector: (state: { activeTool: 'select' }) => string) =>
    selector({ activeTool: 'select' }),
}))

describe('useCanvasFlowController', () => {
  it('owns document wiring and delegates interaction details to one runtime boundary', () => {
    const nodesMap = {} as Y.Map<Node>
    const edgesMap = {} as Y.Map<Edge>
    const doc = {} as Y.Doc
    const { result, unmount } = renderHook(() =>
      useCanvasFlowController({
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

    expect(projectionSpy).toHaveBeenCalledWith({
      nodesMap,
      edgesMap,
      localDraggingIdsRef: expect.any(Object),
      remoteResizeDimensions: session.remoteResizeDimensions,
      remoteDragAnimation,
    })
    expect(keyboardSpy).toHaveBeenCalledWith({
      ...historyMock,
      canEdit: true,
      nodesMap,
      edgesMap,
      selection: selectionController,
    })
    expect(interactionRuntimeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        activeToolId: 'select',
        canEdit: true,
        doc,
        documentWriter: documentWriterMock,
        history: historyMock,
        nodesMap,
        edgesMap,
        remoteDragAnimation,
        selectionController,
        reactFlowInstance: reactFlowMock,
      }),
    )
    expect(result.current).toEqual({
      shellProps: shellPropsMock,
      canEdit: true,
      history: historyMock,
      editSession: session.editSession,
      nodeActions: nodeActionsMock,
      remoteHighlights: session.remoteHighlights,
    })

    unmount()
    expect(clearSelectionSpy).toHaveBeenCalled()
  })
})
