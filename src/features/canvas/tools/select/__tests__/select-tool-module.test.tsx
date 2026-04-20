import { describe, expect, it, vi } from 'vitest'
import { selectToolModule } from '../select-tool-module'
import type { CanvasMeasuredNode, CanvasToolServices } from '../../canvas-tool-types'
import type { Edge, Node } from '@xyflow/react'

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

function createConcaveStrokeNode(id: string): CanvasMeasuredNode {
  return {
    id,
    type: 'stroke',
    position: { x: 0, y: 0 },
    width: 100,
    height: 100,
    data: {
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      points: [
        [20, 20, 0.5],
        [20, 80, 0.5],
        [80, 80, 0.5],
        [80, 20, 0.5],
      ],
      size: 4,
    },
  }
}

describe('selectToolModule', () => {
  it('preserves multi-selection on modifier-click empty canvas', () => {
    const toggleNodeFromTarget = vi.fn()
    const controller = selectToolModule.create(
      createSelectEnvironment({
        getNodes: () => [],
        toggleNodeFromTarget,
      }),
    )

    controller.onPaneClick?.(createMouseEvent(500, 500, { ctrlKey: true }))

    expect(toggleNodeFromTarget).toHaveBeenCalledWith(null, true)
  })

  it('uses the same padded stroke hit test for modifier deselection as for selection', () => {
    const toggleNodeFromTarget = vi.fn()
    const strokeNode = createStrokeNode('stroke-1')
    const controller = selectToolModule.create(
      createSelectEnvironment({
        getNodes: () => [strokeNode],
        toggleNodeFromTarget,
      }),
    )

    controller.onPaneClick?.(createMouseEvent(50, 20, { ctrlKey: true }))

    expect(toggleNodeFromTarget).toHaveBeenCalledWith('stroke-1', true)
  })

  it('hit-tests moved strokes using their current measured position instead of assuming origin placement', () => {
    const toggleNodeFromTarget = vi.fn()
    const strokeNode = createOffsetStrokeNode('stroke-1')
    const controller = selectToolModule.create(
      createSelectEnvironment({
        getNodes: () => [createStrokeNode('stale-stroke')],
        getMeasuredNodes: () => [strokeNode],
        toggleNodeFromTarget,
      }),
    )

    controller.onPaneClick?.(createMouseEvent(470, 250))

    expect(toggleNodeFromTarget).toHaveBeenCalledWith('stroke-1', false)
  })

  it('does not select a concave stroke from clicks in its open interior gap', () => {
    const toggleNodeFromTarget = vi.fn()
    const strokeNode = createConcaveStrokeNode('stroke-1')
    const controller = selectToolModule.create(
      createSelectEnvironment({
        getNodes: () => [strokeNode],
        toggleNodeFromTarget,
      }),
    )

    controller.onPaneClick?.(createMouseEvent(50, 40))

    expect(toggleNodeFromTarget).toHaveBeenCalledWith(null, false)
  })

  it('routes regular node ctrl-click through strict toggle behavior', () => {
    const toggleNodeFromTarget = vi.fn()
    const clickedNode = {
      id: 'c',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {},
    } as Node
    const controller = selectToolModule.create(
      createSelectEnvironment({
        getNodes: () => [clickedNode],
        toggleNodeFromTarget,
      }),
    )

    controller.onNodeClick?.(createMouseEvent(0, 0, { ctrlKey: true }), clickedNode)

    expect(toggleNodeFromTarget).toHaveBeenCalledWith('c', true)
  })

  it('routes edge clicks through explicit edge selection control', () => {
    const toggleNodeFromTarget = vi.fn()
    const toggleEdgeFromTarget = vi.fn()
    const controller = selectToolModule.create(
      createSelectEnvironment({
        getNodes: () => [],
        toggleNodeFromTarget,
        toggleEdgeFromTarget,
      }),
    )

    controller.onEdgeClick?.(createMouseEvent(0, 0, { ctrlKey: true }), {
      id: 'edge-1',
      source: 'a',
      target: 'b',
    } as Edge)

    expect(toggleEdgeFromTarget).toHaveBeenCalledWith('edge-1', true)
    expect(toggleNodeFromTarget).not.toHaveBeenCalled()
  })
})

function createSelectEnvironment({
  getNodes,
  // Intentional compatibility cast: plain React Flow nodes lack measured dimensions, so tests that
  // depend on width/height should override `getMeasuredNodes` or supply measured node objects.
  getMeasuredNodes = () => getNodes() as Array<CanvasMeasuredNode>,
  toggleNodeFromTarget,
  toggleEdgeFromTarget = vi.fn(),
}: {
  getNodes: () => Array<Node>
  getMeasuredNodes?: () => Array<CanvasMeasuredNode>
  toggleNodeFromTarget: (targetId: string | null, toggle: boolean) => void
  toggleEdgeFromTarget?: (targetId: string | null, toggle: boolean) => void
}): CanvasToolServices {
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
      replace: vi.fn(),
      replaceNodes: vi.fn(),
      replaceEdges: vi.fn(),
      clear: vi.fn(),
      getSelectedNodeIds: () => [],
      getSelectedEdgeIds: () => [],
      toggleNodeFromTarget,
      toggleEdgeFromTarget,
      beginGesture: vi.fn(),
      commitGestureSelection: vi.fn(),
      endGesture: vi.fn(),
    },
    interaction: {
      suppressNextSurfaceClick: vi.fn(),
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
    awareness: {
      core: {
        setLocalCursor: () => undefined,
        setLocalDragging: () => undefined,
        setLocalResizing: () => undefined,
        setLocalSelection: () => undefined,
      },
      presence: {
        setPresence: () => undefined,
      },
    },
  }
}
