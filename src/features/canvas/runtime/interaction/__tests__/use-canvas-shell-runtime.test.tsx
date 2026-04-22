import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCanvasShellRuntime } from '../use-canvas-shell-runtime'
import type { Edge, Node, ReactFlowInstance } from '@xyflow/react'
import type * as Y from 'yjs'
import {
  createCanvasDocumentWriter,
  createCanvasRemoteDragAnimation,
  createCanvasSelectionController,
  createCanvasSessionRuntime,
} from '../../__tests__/canvas-runtime-test-utils'
import { testId } from '~/test/helpers/test-id'

const previewSpy = vi.hoisted(() => vi.fn())
const dragHandlersSpy = vi.hoisted(() => vi.fn())
const cursorPresenceSpy = vi.hoisted(() => vi.fn())
const nodeActionsSpy = vi.hoisted(() => vi.fn())

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

describe('useCanvasShellRuntime', () => {
  it('groups shell-only runtime wiring without pulling in surface concerns', () => {
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

    const { result } = renderHook(() =>
      useCanvasShellRuntime({
        canvasId: testId<'sidebarItems'>('canvas-id'),
        campaignId: testId<'campaigns'>('campaign-id'),
        canvasParentId: testId<'sidebarItems'>('parent-id'),
        doc: {} as Y.Doc,
        nodesMap: {} as Y.Map<Node>,
        edgesMap: {} as Y.Map<Edge>,
        canvasSurfaceRef: { current: document.createElement('div') },
        session,
        selectionController,
        documentWriter,
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
    expect(result.current.dragHandlers).toBe(dragHandlersMock)
    expect(result.current.cursorPresence).toBe(cursorPresenceMock)
    expect(result.current.nodeActions).toBe(nodeActionsMock)
    expect(result.current.contextMenu).toEqual({
      campaignId: 'campaign-id',
      canvasParentId: 'parent-id',
      nodesMap: {},
      edgesMap: {},
      createNode: documentWriter.createNode,
      screenToFlowPosition: reactFlowInstance.screenToFlowPosition,
      selectionController,
    })
  })
})
