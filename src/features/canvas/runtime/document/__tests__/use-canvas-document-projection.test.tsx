import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { useCanvasDocumentProjection } from '../use-canvas-document-projection'
import { createCanvasEngine } from '../../../system/canvas-engine'
import type {
  CanvasEdge as Edge,
  CanvasNode as Node,
} from '~/features/canvas/types/canvas-domain-types'

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

describe('useCanvasDocumentProjection', () => {
  it('preserves local selection when remote state props rerender without document changes', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    nodesMap.set('node-1', createTextNode('node-1'))

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
        id: 'node-1',
      }),
    ])
    expect(canvasEngine.getSnapshot().nodes[0]?.selected).toBeUndefined()

    act(() => {
      canvasEngine.setSelection({ nodeIds: new Set(['node-1']), edgeIds: new Set() })
    })

    rerender({
      ...initialProps,
      remoteResizeDimensions: {},
    })

    expect(canvasEngine.getSnapshot().nodes).toEqual([
      expect.objectContaining({
        id: 'node-1',
      }),
    ])
    expect(canvasEngine.getSnapshot().selectedNodeIds).toEqual(new Set(['node-1']))
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

    expect(canvasEngine.getSnapshot().nodes).toHaveLength(2)
    expect(canvasEngine.getSnapshot().nodes).toEqual(
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
    expect(
      canvasEngine.getSnapshot().nodes.find((node) => node.id === 'node-1')?.selected,
    ).toBeUndefined()
    expect(canvasEngine.getSnapshot().edges).toEqual([])

    act(() => {
      canvasEngine.setSelection({ nodeIds: new Set(['node-1']), edgeIds: new Set() })
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

    expect(canvasEngine.getSnapshot().nodes).toHaveLength(2)
    expect(canvasEngine.getSnapshot().nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'node-1' }),
        expect.objectContaining({ id: 'node-2' }),
      ]),
    )
    expect(canvasEngine.getSnapshot().selectedNodeIds).toEqual(new Set(['node-1']))
  })

  it('sorts projected nodes by persisted zIndex without renormalizing their stored values', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    nodesMap.set('node-2', createOrderedTextNode('node-2', 10))
    nodesMap.set('node-1', createOrderedTextNode('node-1', 4))

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

    expect(canvasEngine.getSnapshot().nodes.map((node) => node.id)).toEqual(['node-1', 'node-2'])
    expect(canvasEngine.getSnapshot().nodes.map((node) => node.zIndex)).toEqual([4, 10])
  })

  it('preserves current node order when a document update does not change zIndex', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    nodesMap.set('node-1', createOrderedTextNode('node-1', 1))
    nodesMap.set('node-2', createOrderedTextNode('node-2', 2))

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
      const existing = nodesMap.get('node-1')
      if (!existing) throw new Error('missing node-1')
      nodesMap.set('node-1', {
        ...existing,
        data: { ...existing.data, label: 'Updated' },
      })
    })

    expect(canvasEngine.getSnapshot().nodes.map((node) => node.id)).toEqual(['node-2', 'node-1'])
  })
})
