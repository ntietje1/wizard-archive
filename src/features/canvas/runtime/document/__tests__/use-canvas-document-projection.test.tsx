import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { useCanvasDocumentProjection } from '../use-canvas-document-projection'
import type { CanvasRemoteDragAnimation } from '../../interaction/use-canvas-remote-drag-animation'
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

function createOrderedTextNode(id: string, zIndex: number): Node {
  return {
    ...createTextNode(id),
    zIndex,
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

  it('ignores stale persisted selection flags when document updates rerender nodes', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    nodesMap.set('node-1', {
      ...createTextNode('node-1'),
      selected: true,
      draggable: true,
    })
    nodesMap.set('node-2', {
      ...createTextNode('node-2'),
      position: { x: 220, y: 40 },
      selected: true,
      draggable: true,
    })

    const localDraggingIdsRef = { current: new Set<string>() }

    renderHook(() =>
      useCanvasDocumentProjection({
        nodesMap,
        edgesMap,
        localDraggingIdsRef,
        remoteResizeDimensions: {},
        remoteDragAnimation: createRemoteDragAnimation(),
      }),
    )

    expect(reactFlowMock.nodes).toHaveLength(2)
    expect(reactFlowMock.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'node-1',
          position: { x: 20, y: 40 },
        }),
        expect.objectContaining({
          id: 'node-2',
          position: { x: 220, y: 40 },
        }),
      ]),
    )
    expect(reactFlowMock.nodes.find((node) => node.id === 'node-1')?.selected).toBeUndefined()
    expect(reactFlowMock.edges).toEqual([])

    act(() => {
      reactFlowMock.setNodes((current) =>
        current.map((node) => ({ ...node, selected: node.id === 'node-1' })),
      )
    })

    act(() => {
      const existing = nodesMap.get('node-1')
      if (!existing) {
        throw new Error('missing node-1')
      }

      nodesMap.set('node-1', {
        ...existing,
        data: { ...existing.data, label: 'Updated' },
      })
    })

    expect(reactFlowMock.nodes).toHaveLength(2)
    expect(reactFlowMock.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'node-1', selected: true }),
        expect.objectContaining({ id: 'node-2', selected: false }),
      ]),
    )
  })

  it('sorts projected nodes by persisted zIndex without renormalizing their stored values', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    nodesMap.set('node-2', createOrderedTextNode('node-2', 10))
    nodesMap.set('node-1', createOrderedTextNode('node-1', 4))

    renderHook(() =>
      useCanvasDocumentProjection({
        nodesMap,
        edgesMap,
        localDraggingIdsRef: { current: new Set<string>() },
        remoteResizeDimensions: {},
        remoteDragAnimation: createRemoteDragAnimation(),
      }),
    )

    expect(reactFlowMock.nodes.map((node) => node.id)).toEqual(['node-1', 'node-2'])
    expect(reactFlowMock.nodes.map((node) => node.zIndex)).toEqual([4, 10])
  })
})
