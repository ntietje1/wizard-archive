import { describe, expect, it, vi } from 'vitest'
import { stickyToolModule } from '../sticky-tool-module'
import { textToolModule } from '../text-tool-module'
import type { CanvasToolEnvironment, CanvasToolId } from '../canvas-tool-types'
import type { Node } from '@xyflow/react'

function createMouseEvent(x: number, y: number): React.MouseEvent {
  return {
    clientX: x,
    clientY: y,
  } as React.MouseEvent
}

describe('canvas placement tool modules', () => {
  it('text tool places a text node, requests editing, and completes the action', () => {
    const createdNodes: Array<Node> = []
    const setPendingEditNodeId = vi.fn()
    const setActiveTool = vi.fn()
    const setNodeSelection = vi.fn()
    const controller = textToolModule.create(
      createPlacementEnvironment({
        createNode: (node) => {
          createdNodes.push(node)
        },
        setNodeSelection,
        setPendingEditNodeId,
        setActiveTool,
      }),
    )

    controller.onPaneClick?.(createMouseEvent(100, 200))

    expect(createdNodes).toHaveLength(1)
    expect(createdNodes[0]).toMatchObject({
      type: 'text',
      position: { x: 40, y: 182 },
      selected: true,
      draggable: true,
    })
    expect(setNodeSelection).toHaveBeenCalledWith([createdNodes[0].id])
    expect(setPendingEditNodeId).toHaveBeenCalledWith(createdNodes[0].id)
    expect(setActiveTool).toHaveBeenCalledWith('select')
  })

  it('sticky tool places a sticky node with defaults through the production tool path', () => {
    const createdNodes: Array<Node> = []
    const setPendingEditNodeId = vi.fn()
    const setActiveTool = vi.fn()
    const setNodeSelection = vi.fn()
    const controller = stickyToolModule.create(
      createPlacementEnvironment({
        createNode: (node) => {
          createdNodes.push(node)
        },
        setNodeSelection,
        setPendingEditNodeId,
        setActiveTool,
      }),
    )

    controller.onPaneClick?.(createMouseEvent(40, 60))

    expect(createdNodes).toHaveLength(1)
    expect(createdNodes[0]).toMatchObject({
      type: 'sticky',
      position: { x: -40, y: -20 },
      selected: true,
      draggable: true,
      data: {
        label: '',
        color: '#FFEBA1',
        opacity: 100,
      },
    })
    expect(setNodeSelection).toHaveBeenCalledWith([createdNodes[0].id])
    expect(setPendingEditNodeId).toHaveBeenCalledWith(createdNodes[0].id)
    expect(setActiveTool).toHaveBeenCalledWith('select')
  })
})

function createPlacementEnvironment({
  createNode,
  setNodeSelection,
  setPendingEditNodeId,
  setActiveTool,
}: {
  createNode: (node: Node) => void
  setNodeSelection: (nodeIds: Array<string>) => void
  setPendingEditNodeId: (nodeId: string | null) => void
  setActiveTool: (tool: CanvasToolId) => void
}): CanvasToolEnvironment {
  return {
    viewport: {
      screenToFlowPosition: ({ x, y }) => ({ x, y }),
      getZoom: () => 1,
    },
    document: {
      createNode,
      updateNode: () => undefined,
      updateNodeData: () => undefined,
      resizeNode: () => undefined,
      deleteNodes: () => undefined,
      createEdge: () => undefined,
      deleteEdges: () => undefined,
      setNodePosition: () => undefined,
      getNodes: () => [],
      getEdges: () => [],
      getMeasuredNodes: () => [],
    },
    selection: {
      setNodeSelection,
      clearSelection: () => undefined,
      getSelectedNodeIds: () => [],
    },
    editSession: {
      editingEmbedId: null,
      setEditingEmbedId: () => undefined,
      pendingEditNodeId: null,
      setPendingEditNodeId,
    },
    toolState: {
      getSettings: () => ({
        strokeColor: 'var(--foreground)',
        strokeOpacity: 100,
        strokeSize: 4,
      }),
      getActiveTool: () => 'text',
      setActiveTool,
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
