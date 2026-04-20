import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { useCanvasDocumentWriter } from '../use-canvas-document-writer'
import type { Edge, Node } from '@xyflow/react'

function createTextNode(id: string): Node {
  return {
    id,
    type: 'text',
    position: { x: 10, y: 20 },
    width: 120,
    height: 36,
    data: { label: 'Hello' },
  }
}

function createStrokeNode(id: string): Node {
  return {
    id,
    type: 'stroke',
    position: { x: 0, y: 0 },
    width: 20,
    height: 10,
    data: {
      color: '#000',
      size: 4,
      opacity: 100,
      bounds: { x: 0, y: 0, width: 20, height: 10 },
      points: [
        [0, 0, 0.5],
        [10, 5, 0.5],
        [20, 10, 0.5],
      ],
    },
  }
}

describe('useCanvasDocumentWriter', () => {
  let doc: Y.Doc
  let nodesMap: Y.Map<Node>
  let edgesMap: Y.Map<Edge>

  beforeEach(() => {
    doc = new Y.Doc()
    nodesMap = doc.getMap<Node>('nodes')
    edgesMap = doc.getMap<Edge>('edges')
  })

  afterEach(() => {
    doc.destroy()
  })

  it('creates, updates, and deletes nodes and edges through Yjs transactions', () => {
    const { result } = renderHook(() => useCanvasDocumentWriter({ nodesMap, edgesMap }))

    act(() => {
      result.current.createNode(createTextNode('node-1'))
      result.current.createNode(createTextNode('node-2'))
      result.current.createEdge({
        source: 'node-1',
        target: 'node-2',
        sourceHandle: null,
        targetHandle: null,
      })
    })

    expect(nodesMap.get('node-1')).toMatchObject({
      type: 'text',
      data: { label: 'Hello' },
    })
    expect(Array.from(edgesMap.values())).toHaveLength(1)

    act(() => {
      result.current.updateNodeData('node-1', { label: 'Updated', color: 'red' })
      result.current.setNodePosition('node-1', { x: 50, y: 60 })
    })

    expect(nodesMap.get('node-1')).toMatchObject({
      position: { x: 50, y: 60 },
      data: { label: 'Updated', color: 'red' },
    })

    const [edgeId] = Array.from(edgesMap.keys())
    act(() => {
      result.current.deleteEdges([edgeId])
      result.current.deleteNodes(['node-1'])
    })

    expect(nodesMap.get('node-1')).toBeUndefined()
    expect(edgesMap.get(edgeId)).toBeUndefined()
  })

  it('applies stroke-aware resize behavior without mixing in selection state', () => {
    nodesMap.set('stroke-1', createStrokeNode('stroke-1'))
    const { result } = renderHook(() => useCanvasDocumentWriter({ nodesMap, edgesMap }))

    act(() => {
      result.current.resizeNode('stroke-1', 40, 20, { x: 5, y: 10 })
    })

    const stroke = nodesMap.get('stroke-1')
    expect(stroke).toMatchObject({
      position: { x: 5, y: 10 },
      width: 40,
      height: 20,
    })
    expect(stroke?.data).toMatchObject({
      // Stroke bounds stay in local coordinates; the world position is stored on node.position.
      bounds: { x: 0, y: 0, width: 40, height: 20 },
    })
    expect(stroke?.selected).toBeUndefined()
  })

  it('deletes edges connected to removed nodes in the same document change', () => {
    nodesMap.set('node-1', createTextNode('node-1'))
    nodesMap.set('node-2', createTextNode('node-2'))
    edgesMap.set('edge-1', {
      id: 'edge-1',
      type: 'bezier',
      source: 'node-1',
      target: 'node-2',
    })
    const { result } = renderHook(() => useCanvasDocumentWriter({ nodesMap, edgesMap }))

    act(() => {
      result.current.deleteNodes(['node-1'])
    })

    expect(nodesMap.has('node-1')).toBe(false)
    expect(edgesMap.has('edge-1')).toBe(false)
  })

  it('throws when createNode is called with a duplicate node id', () => {
    nodesMap.set('node-1', createTextNode('node-1'))
    const { result } = renderHook(() => useCanvasDocumentWriter({ nodesMap, edgesMap }))

    expect(() => {
      act(() => {
        result.current.createNode(createTextNode('node-1'))
      })
    }).toThrow('Canvas node "node-1" already exists')
  })
})
