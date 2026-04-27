import { describe, expect, it, vi } from 'vitest'
import { selectToolSpec } from '../select-tool-module'
import type { CanvasMeasuredNode, CanvasToolRuntime } from '../../canvas-tool-types'
import type {
  CanvasEdge as Edge,
  CanvasNode as Node,
} from '~/features/canvas/types/canvas-domain-types'

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

describe('selectToolSpec', () => {
  it('routes regular node ctrl-click through additive selection behavior', () => {
    const toggleNode = vi.fn()
    const clickedNode = {
      id: 'c',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {},
    } as Node
    const controller = selectToolSpec.createHandlers(
      createSelectEnvironment({
        getNodes: () => [clickedNode],
        toggleNode,
      }),
    )

    controller.onNodeClick?.(createMouseEvent(0, 0, { ctrlKey: true }), clickedNode)

    expect(toggleNode).toHaveBeenCalledWith('c', true)
  })

  it('treats shift-only clicks as non-modified point selection', () => {
    const toggleNode = vi.fn()
    const clickedNode = {
      id: 'c',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {},
    } as Node
    const controller = selectToolSpec.createHandlers(
      createSelectEnvironment({
        getNodes: () => [clickedNode],
        toggleNode,
      }),
    )

    controller.onNodeClick?.(createMouseEvent(0, 0, { shiftKey: true }), clickedNode)

    expect(toggleNode).toHaveBeenCalledWith('c', false)
  })

  it('routes edge clicks through explicit edge selection control', () => {
    const toggleNode = vi.fn()
    const toggleEdge = vi.fn()
    const controller = selectToolSpec.createHandlers(
      createSelectEnvironment({
        getNodes: () => [],
        toggleNode,
        toggleEdge,
      }),
    )

    controller.onEdgeClick?.(createMouseEvent(0, 0, { ctrlKey: true }), {
      id: 'edge-1',
      source: 'a',
      target: 'b',
    } as Edge)

    expect(toggleEdge).toHaveBeenCalledWith('edge-1', true)
    expect(toggleNode).not.toHaveBeenCalled()
  })
})

function createSelectEnvironment({
  getNodes,
  // Intentional compatibility cast: plain canvas nodes lack measured dimensions, so tests that
  // depend on width/height should override `getMeasuredNodes` or supply measured node objects.
  getMeasuredNodes = () => getNodes() as Array<CanvasMeasuredNode>,
  toggleNode,
  toggleEdge = vi.fn(),
}: {
  getNodes: () => Array<Node>
  getMeasuredNodes?: () => Array<CanvasMeasuredNode>
  toggleNode: (targetId: string, additive: boolean) => void
  toggleEdge?: (targetId: string, additive: boolean) => void
}): CanvasToolRuntime {
  return {
    viewport: {
      screenToCanvasPosition: ({ x, y }) => ({ x, y }),
      getZoom: () => 1,
    },
    commands: {
      createNode: () => undefined,
      patchNodeData: () => undefined,
      patchEdges: () => undefined,
      resizeNode: () => undefined,
      resizeNodes: () => undefined,
      deleteNodes: () => undefined,
      createEdge: () => undefined,
      deleteEdges: () => undefined,
      setNodePositions: () => undefined,
    },
    query: {
      getNodes,
      getEdges: () => [],
      getMeasuredNodes,
    },
    selection: {
      getSnapshot: () => ({ nodeIds: new Set<string>(), edgeIds: new Set<string>() }),
      setSelection: vi.fn(),
      clearSelection: vi.fn(),
      toggleNode,
      toggleEdge,
      beginGesture: vi.fn(),
      setGesturePreview: vi.fn(),
      commitGesture: vi.fn(),
      cancelGesture: vi.fn(),
    },
    interaction: {
      suppressNextSurfaceClick: vi.fn(),
    },
    modifiers: {
      getShiftPressed: () => false,
      getPrimaryPressed: () => false,
    },
    editSession: {
      editingEmbedId: null,
      setEditingEmbedId: () => undefined,
      pendingEditNodeId: null,
      pendingEditNodePoint: null,
      setPendingEditNodeId: () => undefined,
      setPendingEditNodePoint: () => undefined,
    },
    toolState: {
      getSettings: () => ({
        edgeType: 'bezier',
        strokeColor: 'var(--foreground)',
        strokeOpacity: 100,
        strokeSize: 4,
      }),
      getActiveTool: () => 'select',
      setActiveTool: () => undefined,
      setEdgeType: () => undefined,
      setStrokeColor: () => undefined,
      setStrokeSize: () => undefined,
      setStrokeOpacity: () => undefined,
    },
    awareness: {
      core: {
        setLocalCursor: () => undefined,
        setLocalResizing: () => undefined,
        setLocalSelection: () => undefined,
      },
      presence: {
        setPresence: () => undefined,
      },
    },
  }
}
