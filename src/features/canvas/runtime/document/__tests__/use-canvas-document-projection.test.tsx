import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { useCanvasDocumentProjection } from '../use-canvas-document-projection'
import { createCanvasEngine } from '../../../system/canvas-engine'
import { logger } from '~/shared/utils/logger'
import type {
  CanvasDocumentEdge as Edge,
  CanvasDocumentNode as Node,
} from '~/features/canvas/domain/canvas-document'
vi.mock('~/shared/utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

function createTextNode(id: string): Node {
  return {
    id,
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
    source: 'node-1',
    target: 'node-2',
    type: 'straight',
  }
}

describe('useCanvasDocumentProjection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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
    expect(canvasEngine.getSnapshot().selection.nodeIds).toEqual(new Set())

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

  it('normalizes nodes with stale persisted selection flags at the projection boundary', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    nodesMap.set('node-1', {
      ...createTextNode('node-1'),
      selected: true,
      draggable: true,
    } as unknown as Node)
    nodesMap.set('node-2', {
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

    expect(canvasEngine.getSnapshot().nodes).toEqual([
      expect.objectContaining({ id: 'node-1' }),
      expect.objectContaining({ id: 'node-2' }),
    ])
    expect(canvasEngine.getSnapshot().edges).toEqual([])
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('logs and drops invalid document values at the projection boundary', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    nodesMap.set('node-1', {
      id: 'node-1',
      type: 'text',
      position: { x: Number.NaN, y: 20 },
      data: {},
    } as unknown as Node)
    nodesMap.set('node-2', null as unknown as Node)
    edgesMap.set('edge-1', {
      id: 'edge-1',
      source: 'node-1',
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
    expect(logger.error).toHaveBeenCalledWith(
      'Ignoring invalid canvas document node at projection boundary',
      expect.objectContaining({ id: 'node-1' }),
    )
    expect(logger.error).toHaveBeenCalledWith(
      'Ignoring invalid canvas document edge at projection boundary',
      expect.objectContaining({ id: 'edge-1' }),
    )
    expect(logger.error).toHaveBeenCalledWith(
      'Ignoring invalid canvas document node at projection boundary',
      expect.objectContaining({ id: 'node-2', value: null }),
    )
    expect(logger.error).toHaveBeenCalledWith(
      'Ignoring invalid canvas document edge at projection boundary',
      expect.objectContaining({ id: 'edge-2', value: false }),
    )
  })

  it('drops document values whose stored id no longer matches the Yjs map key', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    nodesMap.set('node-1', createTextNode('node-1'))
    nodesMap.set('node-2', createTextNode('node-2'))
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
      nodesMap.set('node-1', createTextNode('node-2'))
      edgesMap.set('edge-1', createEdge('edge-2'))
    })

    expect(canvasEngine.getSnapshot().nodes.map((node) => node.id)).toEqual(['node-2'])
    expect(canvasEngine.getSnapshot().edges).toEqual([])
    expect(logger.error).toHaveBeenCalledWith(
      'Ignoring canvas document node with mismatched map key at projection boundary',
      expect.objectContaining({ id: 'node-1', valueId: 'node-2' }),
    )
    expect(logger.error).toHaveBeenCalledWith(
      'Ignoring canvas document edge with mismatched map key at projection boundary',
      expect.objectContaining({ id: 'edge-1', valueId: 'edge-2' }),
    )
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
        data: { ...existing.data, backgroundColor: 'var(--background)' },
      } as Node)
    })

    expect(canvasEngine.getSnapshot().nodes.map((node) => node.id)).toEqual(['node-2', 'node-1'])
  })
})
