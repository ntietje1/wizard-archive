import { act, renderHook } from '@testing-library/react'
import { testCanvasNodeId } from 'shared/test/canvas-node-id'
import { describe, expect, it } from 'vite-plus/test'
import * as Y from 'yjs'
import { useCanvasDocumentProjection } from '../use-canvas-document-projection'
import { createCanvasEngine } from '../../../system/canvas-engine'
import type {
  CanvasDocumentEdge as Edge,
  CanvasDocumentNode as Node,
} from '../../../document-contract'
type TextNode = Extract<Node, { type: 'text' }>

function createTextNode(id: string): TextNode {
  return {
    id: testCanvasNodeId(id),
    type: 'text',
    position: { x: 20, y: 40 },
    width: 120,
    height: 36,
    data: { content: [{ type: 'paragraph' }] },
  }
}

function createOrderedTextNode(id: string, zIndex: number): Node {
  return {
    ...createTextNode(id),
    zIndex,
  }
}

function createEdge(id: string): Edge {
  return {
    id,
    source: testCanvasNodeId('node-1'),
    target: testCanvasNodeId('node-2'),
    type: 'straight',
  }
}

describe('useCanvasDocumentProjection', () => {
  it('preserves local selection when remote state props rerender without document changes', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    nodesMap.set(testCanvasNodeId('node-1'), createTextNode('node-1'))

    const localDraggingIdsRef = { current: new Set<string>() }
    const canvasEngine = createCanvasEngine()
    const initialProps = {
      canvasEngine,
      nodesMap,
      edgesMap,
      localDraggingIdsRef,
      remoteResizeDimensions: {},
    }

    const { rerender } = renderHook(
      (props: typeof initialProps) => useCanvasDocumentProjection(props),
      {
        initialProps,
      },
    )

    expect(canvasEngine.getSnapshot().nodes).toEqual([
      expect.objectContaining({
        id: testCanvasNodeId('node-1'),
      }),
    ])
    expect(canvasEngine.getSnapshot().selection.nodeIds).toEqual(new Set())

    act(() => {
      canvasEngine.setSelection({
        nodeIds: new Set([testCanvasNodeId('node-1')]),
        edgeIds: new Set(),
      })
    })

    rerender({
      ...initialProps,
      remoteResizeDimensions: {},
    })

    expect(canvasEngine.getSnapshot().nodes).toEqual([
      expect.objectContaining({
        id: testCanvasNodeId('node-1'),
      }),
    ])
    expect(canvasEngine.getSnapshot().selectedNodeIds).toEqual(
      new Set([testCanvasNodeId('node-1')]),
    )
  })

  it('removes deleted document ids from local selection', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    nodesMap.set(testCanvasNodeId('node-1'), createTextNode('node-1'))
    nodesMap.set(testCanvasNodeId('node-2'), createTextNode('node-2'))
    edgesMap.set('edge-1', createEdge('edge-1'))
    const canvasEngine = createCanvasEngine()

    renderHook(() =>
      useCanvasDocumentProjection({
        canvasEngine,
        nodesMap,
        edgesMap,
        localDraggingIdsRef: { current: new Set<string>() },
        remoteResizeDimensions: {},
      }),
    )

    act(() => {
      canvasEngine.setSelection({
        nodeIds: new Set([testCanvasNodeId('node-1')]),
        edgeIds: new Set(['edge-1']),
      })
      doc.transact(() => {
        nodesMap.delete(testCanvasNodeId('node-1'))
        edgesMap.delete('edge-1')
      })
    })

    expect(canvasEngine.getSnapshot().selection.nodeIds).toEqual(new Set())
    expect(canvasEngine.getSnapshot().selection.edgeIds).toEqual(new Set())
  })

  it('normalizes nodes with stale persisted selection flags at the projection boundary', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    nodesMap.set(testCanvasNodeId('node-1'), {
      ...createTextNode('node-1'),
      selected: true,
      draggable: true,
    } as unknown as Node)
    nodesMap.set(testCanvasNodeId('node-2'), {
      ...createTextNode('node-2'),
      position: { x: 220, y: 40 },
      selected: true,
      draggable: true,
    } as unknown as Node)

    const localDraggingIdsRef = { current: new Set<string>() }

    const canvasEngine = createCanvasEngine()

    renderHook(() =>
      useCanvasDocumentProjection({
        canvasEngine,
        nodesMap,
        edgesMap,
        localDraggingIdsRef,
        remoteResizeDimensions: {},
      }),
    )

    expect(canvasEngine.getSnapshot().nodes.map((node) => node.id)).toEqual([
      testCanvasNodeId('node-1'),
      testCanvasNodeId('node-2'),
    ])
    for (const node of canvasEngine.getSnapshot().nodes) {
      expect(node).not.toHaveProperty('selected')
      expect(node).not.toHaveProperty('draggable')
    }
    expect(canvasEngine.getSnapshot().edges).toEqual([])
  })

  it('does not leak local runtime-only node fields through document updates', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    nodesMap.set(testCanvasNodeId('node-1'), createTextNode('node-1'))

    const canvasEngine = createCanvasEngine()

    renderHook(() =>
      useCanvasDocumentProjection({
        canvasEngine,
        nodesMap,
        edgesMap,
        localDraggingIdsRef: { current: new Set<string>() },
        remoteResizeDimensions: {},
      }),
    )

    act(() => {
      const staleRuntimeNode = {
        ...canvasEngine.getSnapshot().nodes[0],
        selected: true,
        draggable: false,
      } as unknown as Node
      canvasEngine.setDocumentSnapshot({
        nodes: [staleRuntimeNode],
      })
      nodesMap.set(testCanvasNodeId('node-1'), {
        ...createTextNode('node-1'),
        data: { content: [{ type: 'paragraph', props: { textColor: 'blue' } }] },
      })
    })

    const [projectedNode] = canvasEngine.getSnapshot().nodes
    expect(projectedNode).toMatchObject({
      id: testCanvasNodeId('node-1'),
      data: { content: [{ type: 'paragraph', props: { textColor: 'blue' } }] },
    })
    expect(projectedNode).not.toHaveProperty('selected')
    expect(projectedNode).not.toHaveProperty('draggable')
  })

  it('drops invalid document values at the projection boundary', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    nodesMap.set(testCanvasNodeId('node-1'), {
      id: testCanvasNodeId('node-1'),
      type: 'text',
      position: { x: Number.NaN, y: 20 },
      data: {},
    } as unknown as Node)
    nodesMap.set(testCanvasNodeId('node-2'), null as unknown as Node)
    edgesMap.set('edge-1', {
      id: 'edge-1',
      source: testCanvasNodeId('node-1'),
      target: '',
      type: 'straight',
    } as unknown as Edge)
    edgesMap.set('edge-2', false as unknown as Edge)

    const canvasEngine = createCanvasEngine()

    renderHook(() =>
      useCanvasDocumentProjection({
        canvasEngine,
        nodesMap,
        edgesMap,
        localDraggingIdsRef: { current: new Set<string>() },
        remoteResizeDimensions: {},
      }),
    )

    expect(canvasEngine.getSnapshot().nodes).toEqual([])
    expect(canvasEngine.getSnapshot().edges).toEqual([])
  })

  it('drops document values whose stored id no longer matches the Yjs map key', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    nodesMap.set(testCanvasNodeId('node-1'), createTextNode('node-1'))
    nodesMap.set(testCanvasNodeId('node-2'), createTextNode('node-2'))
    edgesMap.set('edge-1', createEdge('edge-1'))

    const canvasEngine = createCanvasEngine()

    renderHook(() =>
      useCanvasDocumentProjection({
        canvasEngine,
        nodesMap,
        edgesMap,
        localDraggingIdsRef: { current: new Set<string>() },
        remoteResizeDimensions: {},
      }),
    )

    act(() => {
      nodesMap.set(testCanvasNodeId('node-1'), createTextNode('node-2'))
      edgesMap.set('edge-1', createEdge('edge-2'))
    })

    expect(canvasEngine.getSnapshot().nodes.map((node) => node.id)).toEqual([
      testCanvasNodeId('node-2'),
    ])
    expect(canvasEngine.getSnapshot().edges).toEqual([])
  })

  it('sorts projected nodes by persisted zIndex without renormalizing their stored values', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    nodesMap.set(testCanvasNodeId('node-2'), createOrderedTextNode('node-2', 10))
    nodesMap.set(testCanvasNodeId('node-1'), createOrderedTextNode('node-1', 4))

    const canvasEngine = createCanvasEngine()

    renderHook(() =>
      useCanvasDocumentProjection({
        canvasEngine,
        nodesMap,
        edgesMap,
        localDraggingIdsRef: { current: new Set<string>() },
        remoteResizeDimensions: {},
      }),
    )

    expect(canvasEngine.getSnapshot().nodes.map((node) => node.id)).toEqual([
      testCanvasNodeId('node-1'),
      testCanvasNodeId('node-2'),
    ])
    expect(canvasEngine.getSnapshot().nodes.map((node) => node.zIndex)).toEqual([4, 10])
  })

  it('preserves current node order when a document update does not change zIndex', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    nodesMap.set(testCanvasNodeId('node-1'), createOrderedTextNode('node-1', 1))
    nodesMap.set(testCanvasNodeId('node-2'), createOrderedTextNode('node-2', 2))

    const canvasEngine = createCanvasEngine()

    renderHook(() =>
      useCanvasDocumentProjection({
        canvasEngine,
        nodesMap,
        edgesMap,
        localDraggingIdsRef: { current: new Set<string>() },
        remoteResizeDimensions: {},
      }),
    )

    act(() => {
      canvasEngine.setDocumentSnapshot({ nodes: [...canvasEngine.getSnapshot().nodes].reverse() })
    })

    act(() => {
      const existing = nodesMap.get(testCanvasNodeId('node-1'))
      if (!existing) throw new Error('missing node-1')
      nodesMap.set(testCanvasNodeId('node-1'), {
        ...existing,
        data: { ...existing.data, backgroundColor: 'var(--background)' },
      } as Node)
    })

    expect(canvasEngine.getSnapshot().nodes.map((node) => node.id)).toEqual([
      testCanvasNodeId('node-2'),
      testCanvasNodeId('node-1'),
    ])
  })

  it('restores document node dimensions when remote resize awareness clears', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    nodesMap.set(testCanvasNodeId('node-1'), createTextNode('node-1'))

    const canvasEngine = createCanvasEngine()
    const localDraggingIdsRef = { current: new Set<string>() }
    const initialProps = {
      canvasEngine,
      nodesMap,
      edgesMap,
      localDraggingIdsRef,
      remoteResizeDimensions: {},
    }

    const { rerender } = renderHook(
      (props: typeof initialProps) => useCanvasDocumentProjection(props),
      { initialProps },
    )

    rerender({
      ...initialProps,
      remoteResizeDimensions: {
        [testCanvasNodeId('node-1')]: { x: 90, y: 100, width: 300, height: 180 },
      },
    })

    expect(
      canvasEngine.getSnapshot().nodeLookup.get(testCanvasNodeId('node-1'))?.node,
    ).toMatchObject({
      position: { x: 90, y: 100 },
      width: 300,
      height: 180,
    })

    rerender({
      ...initialProps,
      remoteResizeDimensions: {},
    })

    expect(
      canvasEngine.getSnapshot().nodeLookup.get(testCanvasNodeId('node-1'))?.node,
    ).toMatchObject({
      position: { x: 20, y: 40 },
      width: 120,
      height: 36,
    })
  })

  it('restores nodes removed from remote resize awareness while other remote resizes remain', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    nodesMap.set(testCanvasNodeId('node-1'), createTextNode('node-1'))
    nodesMap.set(testCanvasNodeId('node-2'), {
      ...createTextNode('node-2'),
      position: { x: 240, y: 80 },
      width: 160,
      height: 52,
    })

    const canvasEngine = createCanvasEngine()
    const localDraggingIdsRef = { current: new Set<string>() }
    const initialProps = {
      canvasEngine,
      nodesMap,
      edgesMap,
      localDraggingIdsRef,
      remoteResizeDimensions: {},
    }

    const { rerender } = renderHook(
      (props: typeof initialProps) => useCanvasDocumentProjection(props),
      { initialProps },
    )

    rerender({
      ...initialProps,
      remoteResizeDimensions: {
        [testCanvasNodeId('node-1')]: { x: 90, y: 100, width: 300, height: 180 },
        [testCanvasNodeId('node-2')]: { x: 320, y: 140, width: 240, height: 120 },
      },
    })
    rerender({
      ...initialProps,
      remoteResizeDimensions: {
        [testCanvasNodeId('node-2')]: { x: 340, y: 160, width: 260, height: 140 },
      },
    })

    expect(
      canvasEngine.getSnapshot().nodeLookup.get(testCanvasNodeId('node-1'))?.node,
    ).toMatchObject({
      position: { x: 20, y: 40 },
      width: 120,
      height: 36,
    })
    expect(
      canvasEngine.getSnapshot().nodeLookup.get(testCanvasNodeId('node-2'))?.node,
    ).toMatchObject({
      position: { x: 340, y: 160 },
      width: 260,
      height: 140,
    })
  })
})
