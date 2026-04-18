import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { useCanvasDocumentProjection } from '../useCanvasDocumentProjection'
import type { CanvasRemoteDragAnimation } from '../useCanvasRemoteDragAnimation'
import type { Edge, Node } from '@xyflow/react'

const reactFlowMock = vi.hoisted(() => {
  let nodes: Array<Node> = []
  let edges: Array<Edge> = []

  return {
    get nodes() {
      return nodes
    },
    get edges() {
      return edges
    },
    reset() {
      nodes = []
      edges = []
    },
    setNodes(updater: Array<Node> | ((nodes: Array<Node>) => Array<Node>)) {
      nodes = typeof updater === 'function' ? updater(nodes) : updater
    },
    setEdges(updater: Array<Edge> | ((edges: Array<Edge>) => Array<Edge>)) {
      edges = typeof updater === 'function' ? updater(edges) : updater
    },
  }
})

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => reactFlowMock,
}))

function createTextNode(id: string): Node {
  return {
    id,
    type: 'text',
    position: { x: 20, y: 40 },
    width: 120,
    height: 36,
    data: { label: 'Hello' },
  }
}

function createRemoteDragAnimation(): CanvasRemoteDragAnimation {
  return {
    hasSpring: () => false,
    setTarget: vi.fn(),
    clearNodeSprings: vi.fn(),
  }
}

describe('useCanvasDocumentProjection', () => {
  beforeEach(() => {
    reactFlowMock.reset()
  })

  it('preserves local selection when remote state props rerender without document changes', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    nodesMap.set('node-1', createTextNode('node-1'))

    const localDraggingIdsRef = { current: new Set<string>() }
    const initialProps = {
      nodesMap,
      edgesMap,
      localDraggingIdsRef,
      remoteResizeDimensions: {},
      remoteDragAnimation: createRemoteDragAnimation(),
    }

    const { rerender } = renderHook(
      (props: typeof initialProps) => useCanvasDocumentProjection(props),
      {
        initialProps,
      },
    )

    expect(reactFlowMock.nodes).toEqual([
      expect.objectContaining({
        id: 'node-1',
      }),
    ])
    expect(reactFlowMock.nodes[0]?.selected).toBeUndefined()

    act(() => {
      reactFlowMock.setNodes((current) =>
        current.map((node) => (node.id === 'node-1' ? { ...node, selected: true } : node)),
      )
    })

    rerender({
      ...initialProps,
      remoteResizeDimensions: {},
      remoteDragAnimation: createRemoteDragAnimation(),
    })

    expect(reactFlowMock.nodes).toEqual([
      expect.objectContaining({
        id: 'node-1',
        selected: true,
      }),
    ])
  })
})
