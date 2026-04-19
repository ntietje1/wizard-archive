import { describe, expect, it, vi } from 'vitest'
import { selectToolModule } from '../select-tool-module'
import type { CanvasMeasuredNode, CanvasToolEnvironment } from '../canvas-tool-types'
import type { Node } from '@xyflow/react'

function createMouseEvent(
  x: number,
  y: number,
  overrides: Partial<React.MouseEvent> = {},
): React.MouseEvent {
  return {
    clientX: x,
    clientY: y,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    target: {},
    ...overrides,
  } as React.MouseEvent
}

function createStrokeNode(id: string): CanvasMeasuredNode {
  return {
    id,
    type: 'stroke',
    position: { x: 0, y: 0 },
    width: 100,
    height: 20,
    data: {
      bounds: { x: 0, y: 0, width: 100, height: 20 },
      points: [
        [0, 10, 0.5],
        [100, 10, 0.5],
      ],
      size: 4,
    },
  }
}

function createOffsetStrokeNode(id: string): CanvasMeasuredNode {
  return {
    id,
    type: 'stroke',
    position: { x: 420, y: 240 },
    width: 100,
    height: 20,
    data: {
      bounds: { x: 120, y: 40, width: 100, height: 20 },
      points: [
        [120, 50, 0.5],
        [220, 50, 0.5],
      ],
      size: 4,
    },
  }
}

describe('selectToolModule', () => {
  it('preserves multi-selection on modifier-click empty canvas', async () => {
    const setNodeSelection = vi.fn()
    const controller = selectToolModule.create(
      createSelectEnvironment({
        getNodes: () => [],
        getSelectedNodeIds: () => ['a', 'b'],
        setNodeSelection,
      }),
    )

    controller.onPaneClick?.(createMouseEvent(500, 500, { ctrlKey: true }))
    await Promise.resolve()

    expect(setNodeSelection).toHaveBeenCalledWith(['a', 'b'])
  })

  it('uses the same padded stroke hit test for modifier deselection as for selection', async () => {
    const setNodeSelection = vi.fn()
    const strokeNode = createStrokeNode('stroke-1')
    const controller = selectToolModule.create(
      createSelectEnvironment({
        getNodes: () => [strokeNode],
        getSelectedNodeIds: () => ['stroke-1', 'embed-1'],
        setNodeSelection,
      }),
    )

    controller.onPaneClick?.(createMouseEvent(50, 20, { ctrlKey: true }))
    await Promise.resolve()

    expect(setNodeSelection).toHaveBeenCalledWith(['embed-1'])
  })

  it('hit-tests moved strokes using their current measured position instead of assuming origin placement', async () => {
    const setNodeSelection = vi.fn()
    const strokeNode = createOffsetStrokeNode('stroke-1')
    const controller = selectToolModule.create(
      createSelectEnvironment({
        getNodes: () => [createStrokeNode('stale-stroke')],
        getMeasuredNodes: () => [strokeNode],
        getSelectedNodeIds: () => [],
        setNodeSelection,
      }),
    )

    controller.onPaneClick?.(createMouseEvent(470, 250))
    await Promise.resolve()

    expect(setNodeSelection).toHaveBeenCalledWith(['stroke-1'])
  })

  it('routes regular node ctrl-click through strict toggle behavior', async () => {
    const setNodeSelection = vi.fn()
    const clickedNode = {
      id: 'c',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {},
    } as Node
    const controller = selectToolModule.create(
      createSelectEnvironment({
        getNodes: () => [clickedNode],
        getSelectedNodeIds: () => ['a', 'b'],
        setNodeSelection,
      }),
    )

    controller.onNodeClick?.(createMouseEvent(0, 0, { ctrlKey: true }), clickedNode)
    await Promise.resolve()

    expect(setNodeSelection).toHaveBeenCalledWith(['a', 'b', 'c'])
  })
})

function createSelectEnvironment({
  getNodes,
  // Intentional compatibility cast: plain React Flow nodes lack measured dimensions, so tests that
  // depend on width/height should override `getMeasuredNodes` or supply measured node objects.
  getMeasuredNodes = () => getNodes() as Array<CanvasMeasuredNode>,
  getSelectedNodeIds,
  setNodeSelection,
}: {
  getNodes: () => Array<Node>
  getMeasuredNodes?: () => Array<CanvasMeasuredNode>
  getSelectedNodeIds: () => Array<string>
  setNodeSelection: (nodeIds: Array<string>) => void
}): CanvasToolEnvironment {
  return {
    viewport: {
      screenToFlowPosition: ({ x, y }) => ({ x, y }),
      getZoom: () => 1,
    },
    document: {
      createNode: () => undefined,
      updateNode: () => undefined,
      updateNodeData: () => undefined,
      resizeNode: () => undefined,
      deleteNodes: () => undefined,
      createEdge: () => undefined,
      deleteEdges: () => undefined,
      setNodePosition: () => undefined,
      getNodes,
      getEdges: () => [],
      getMeasuredNodes,
    },
    selection: {
      setNodeSelection,
      clearSelection: vi.fn(),
      getSelectedNodeIds,
    },
    editSession: {
      editingEmbedId: null,
      setEditingEmbedId: () => undefined,
      pendingEditNodeId: null,
      setPendingEditNodeId: () => undefined,
    },
    toolState: {
      getSettings: () => ({
        strokeColor: 'var(--foreground)',
        strokeOpacity: 100,
        strokeSize: 4,
      }),
      getActiveTool: () => 'select',
      setActiveTool: () => undefined,
      setStrokeColor: () => undefined,
      setStrokeSize: () => undefined,
      setStrokeOpacity: () => undefined,
    },
    interaction: {
      setLocalDrawing: () => undefined,
      setLassoPath: () => undefined,
      setSelectionDragRect: () => undefined,
      setErasingStrokeIds: () => undefined,
      setRectDeselectedIds: () => undefined,
    },
    awareness: {
      setLocalPresence: () => undefined,
      setLocalCursor: () => undefined,
      setLocalDragging: () => undefined,
      setLocalResizing: () => undefined,
      setLocalSelection: () => undefined,
      setLocalDrawing: () => undefined,
      setLocalSelecting: () => undefined,
    },
  }
}
