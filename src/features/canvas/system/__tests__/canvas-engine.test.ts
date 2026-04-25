import { describe, expect, it, vi } from 'vitest'
import { createCanvasEngine } from '../canvas-engine'
import {
  areCanvasPropertyEdgesEqual,
  areCanvasPropertyNodesEqual,
  areCanvasEdgeEndpointNodesEqual,
  selectCanvasEdgeEndpointNodes,
} from '../canvas-engine-selectors'
import type { Edge, Node } from '@xyflow/react'

describe('createCanvasEngine', () => {
  it('stores document nodes as ordered ids plus lookup entries', () => {
    const engine = createCanvasEngine()
    const first = createNode('first', 2)
    const second = createNode('second', 1)

    engine.setDocumentSnapshot({ nodes: [first, second] })

    const snapshot = engine.getSnapshot()
    expect(snapshot.nodeIds).toEqual(['first', 'second'])
    expect(snapshot.nodeLookup.get('first')?.node).toBe(first)
    expect(snapshot.nodeLookup.get('second')?.zIndex).toBe(1)
  })

  it('notifies endpoint selectors only when one endpoint node changes', () => {
    const engine = createCanvasEngine()
    engine.setDocumentSnapshot({
      nodes: [createNode('source', 0), createNode('target', 1), createNode('other', 2)],
      edges: [createEdge('edge-1', 'source', 'target')],
    })

    const listener = vi.fn()
    engine.subscribeSelector(
      (snapshot) => selectCanvasEdgeEndpointNodes(snapshot, 'source', 'target'),
      listener,
      areCanvasEdgeEndpointNodesEqual,
    )

    engine.setNodePositions(new Map([['other', { x: 50, y: 50 }]]))
    expect(listener).not.toHaveBeenCalled()

    engine.setNodePositions(new Map([['source', { x: 20, y: 30 }]]))
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0]?.[0].source?.position).toEqual({ x: 20, y: 30 })
  })

  it('tracks selection as sets without rewriting document order', () => {
    const engine = createCanvasEngine()
    engine.setDocumentSnapshot({
      nodes: [createNode('a', 0), createNode('b', 1)],
      edges: [createEdge('edge-1', 'a', 'b')],
    })

    engine.setSelection({
      nodeIds: new Set(['b']),
      edgeIds: new Set(['edge-1']),
    })

    const snapshot = engine.getSnapshot()
    expect(snapshot.nodeIds).toEqual(['a', 'b'])
    expect(snapshot.selectedNodeIds.has('b')).toBe(true)
    expect(snapshot.nodeLookup.get('b')?.selected).toBe(true)
    expect(snapshot.edgeLookup.get('edge-1')?.selected).toBe(true)
  })

  it('does not notify when clearing an already-empty selection', () => {
    const engine = createCanvasEngine()
    const listener = vi.fn()
    engine.subscribe(listener)

    engine.clearSelection()

    expect(listener).not.toHaveBeenCalled()
  })

  it('clears only previously selected item internals', () => {
    const engine = createCanvasEngine()
    engine.setDocumentSnapshot({
      nodes: [createNode('a', 0), createNode('b', 1), createNode('c', 2)],
      edges: [createEdge('edge-1', 'a', 'b'), createEdge('edge-2', 'b', 'c')],
    })
    engine.setSelection({
      nodeIds: new Set(['a']),
      edgeIds: new Set(['edge-1']),
    })
    const selectedNodeBefore = engine.getSnapshot().nodeLookup.get('a')
    const untouchedNodeBefore = engine.getSnapshot().nodeLookup.get('b')
    const untouchedEdgeBefore = engine.getSnapshot().edgeLookup.get('edge-2')

    engine.clearSelection()
    const snapshot = engine.getSnapshot()

    expect(snapshot.nodeLookup.get('a')).not.toBe(selectedNodeBefore)
    expect(snapshot.nodeLookup.get('b')).toBe(untouchedNodeBefore)
    expect(snapshot.edgeLookup.get('edge-2')).toBe(untouchedEdgeBefore)
    expect(snapshot.dirtyNodeIds).toEqual(new Set(['a']))
    expect(snapshot.dirtyEdgeIds).toEqual(new Set(['edge-1']))
  })

  it('updates pending previews without rebuilding node and edge lookups', () => {
    const engine = createCanvasEngine()
    engine.setDocumentSnapshot({
      nodes: [createNode('a', 0), createNode('b', 1)],
      edges: [createEdge('edge-1', 'a', 'b')],
    })
    const nodeLookupBefore = engine.getSnapshot().nodeLookup
    const edgeLookupBefore = engine.getSnapshot().edgeLookup

    engine.beginSelectionGesture('marquee', 'replace')
    engine.setSelectionGesturePreview({
      nodeIds: new Set(['a']),
      edgeIds: new Set(['edge-1']),
    })

    expect(engine.getSnapshot().nodeLookup).toBe(nodeLookupBefore)
    expect(engine.getSnapshot().edgeLookup).toBe(edgeLookupBefore)
  })

  it('commits the cached pending gesture preview without recomputing geometry', () => {
    const engine = createCanvasEngine()
    engine.setDocumentSnapshot({
      nodes: [createNode('a', 0), createNode('b', 1)],
      edges: [createEdge('edge-1', 'a', 'b')],
    })
    engine.beginSelectionGesture('lasso', 'replace')
    engine.setSelectionGesturePreview({
      nodeIds: new Set(['b']),
      edgeIds: new Set(['edge-1']),
    })

    engine.commitSelectionGesture()

    expect(engine.getSnapshot().selection.nodeIds).toEqual(new Set(['b']))
    expect(engine.getSnapshot().selection.edgeIds).toEqual(new Set(['edge-1']))
    expect(engine.getSnapshot().selection.pendingPreview).toEqual({ kind: 'inactive' })
    expect(engine.getSnapshot().selection.gestureKind).toBeNull()
  })

  it('marks only dragged nodes dirty during drag sessions', () => {
    const engine = createCanvasEngine()
    engine.setDocumentSnapshot({ nodes: [createNode('a', 0), createNode('b', 1)] })
    const documentNodes = engine.getSnapshot().nodes

    engine.startDrag(new Set(['a']))
    expect(engine.getSnapshot().nodeLookup.get('a')?.dragging).toBe(true)
    expect(engine.getSnapshot().nodeLookup.get('b')?.dragging).toBe(false)

    engine.updateDrag(new Map([['a', { x: 10, y: 12 }]]))
    expect(engine.getSnapshot().nodes).toBe(documentNodes)
    expect(engine.getSnapshot().nodeLookup.get('a')?.node.position).toEqual({ x: 10, y: 12 })

    engine.stopDrag()
    expect(engine.getSnapshot().nodeLookup.get('a')?.dragging).toBe(false)
    expect(engine.getSnapshot().dirtyNodeIds).toEqual(new Set(['a']))
  })

  it('keeps drag positions in runtime lookup until document positions are committed', () => {
    const engine = createCanvasEngine()
    engine.setDocumentSnapshot({ nodes: [createNode('a', 0)] })

    engine.startDrag(new Set(['a']))
    engine.updateDrag(new Map([['a', { x: 10, y: 12 }]]))
    engine.setNodePositions(new Map([['a', { x: 10, y: 12 }]]))
    engine.stopDrag()

    const snapshot = engine.getSnapshot()
    expect(snapshot.nodes[0]?.position).toEqual({ x: 10, y: 12 })
    expect(snapshot.nodeLookup.get('a')?.node.position).toEqual({ x: 10, y: 12 })
    expect(snapshot.nodeLookup.get('a')?.dragging).toBe(false)
  })

  it('updates live drag DOM transforms and connected edge paths without notifying subscribers', () => {
    const engine = createCanvasEngine()
    const source = { ...createNode('source', 0), width: 100, height: 50 }
    const target = {
      ...createNode('target', 1),
      position: { x: 200, y: 0 },
      width: 100,
      height: 50,
    }
    const nodeElement = document.createElement('div')
    const edgePath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    const unsubscribeNode = engine.registerNodeElement('source', nodeElement)
    const unsubscribeEdge = engine.registerEdgePaths('edge-1', {
      path: edgePath,
      highlightPath: null,
      interactionPath: null,
    })
    engine.setDocumentSnapshot({
      nodes: [source, target],
      edges: [createEdge('edge-1', 'source', 'target')],
    })
    engine.startDrag(new Set(['source']))
    const listener = vi.fn()
    const unsubscribe = engine.subscribe(listener)

    engine.updateDrag(new Map([['source', { x: 20, y: 10 }]]))
    engine.flushRenderScheduler()

    expect(listener).not.toHaveBeenCalled()
    expect(nodeElement.style.transform).toBe('translate(20px, 10px)')
    expect(edgePath.getAttribute('d')).toBeTruthy()

    engine.stopDrag()
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    unsubscribeNode()
    unsubscribeEdge()
    engine.destroy()
  })

  it('merges visual node data patches with the current engine data before writing DOM styles', () => {
    const engine = createCanvasEngine()
    const nodeSurface = document.createElement('div')
    engine.setDocumentSnapshot({
      nodes: [
        {
          ...createNode('a', 0),
          data: {
            backgroundColor: '#ff0000',
            backgroundOpacity: 100,
            borderStroke: '#000000',
            borderOpacity: 100,
            borderWidth: 1,
          },
        },
      ],
    })
    const unregister = engine.registerNodeSurfaceElement('a', nodeSurface)

    engine.scheduleNodeDataPatches(new Map([['a', { borderWidth: 4 }]]))
    engine.flushRenderScheduler()

    expect(nodeSurface.style.backgroundColor).toBe('rgb(255, 0, 0)')
    expect(nodeSurface.style.border).toBe('4px solid rgb(0, 0, 0)')

    unregister()
    engine.destroy()
  })

  it('updates live viewport transforms without notifying subscribers until commit', () => {
    const engine = createCanvasEngine()
    const viewportElement = document.createElement('div')
    const unregister = engine.registerViewportElement(viewportElement)
    const listener = vi.fn()
    const unsubscribe = engine.subscribe(listener)

    engine.setViewportLive({ x: 10, y: 20, zoom: 2 })
    engine.flushRenderScheduler()

    expect(listener).not.toHaveBeenCalled()
    expect(engine.getSnapshot().viewport).toEqual({ x: 10, y: 20, zoom: 2 })
    expect(viewportElement.style.transform).toBe('translate(10px, 20px) scale(2)')

    engine.setViewport({ x: 10, y: 20, zoom: 2 })
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    unregister()
    engine.destroy()
  })

  it('updates registered stroke paths from visual node data patches', () => {
    const engine = createCanvasEngine()
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    const highlightPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    const unregister = engine.registerStrokeNodePaths('stroke-1', {
      path,
      highlightPath,
    })
    engine.setDocumentSnapshot({
      nodes: [
        {
          ...createNode('stroke-1', 0),
          type: 'stroke',
          data: {
            points: [
              [0, 0, 0.5],
              [24, 0, 0.5],
            ],
            bounds: { x: 0, y: 0, width: 24, height: 1 },
            color: 'var(--foreground)',
            size: 4,
          },
        },
      ],
    })

    engine.scheduleNodeDataPatches(new Map([['stroke-1', { size: 8 }]]))
    engine.flushRenderScheduler()

    expect(path.getAttribute('d')).toBeTruthy()
    expect(highlightPath.getAttribute('d')).toBeTruthy()

    unregister()
    engine.destroy()
  })
})

describe('canvas engine property selectors', () => {
  it('treats node position-only changes as equal for property subscribers', () => {
    const node = createNode('a', 0)
    const movedNode = { ...node, position: { x: 10, y: 12 } }
    const updatedNode = { ...node, data: { color: 'red' } }

    expect(areCanvasPropertyNodesEqual([node], [movedNode])).toBe(true)
    expect(areCanvasPropertyNodesEqual([node], [updatedNode])).toBe(false)
  })

  it('treats edge endpoint-only changes as equal for property subscribers', () => {
    const edge = createEdge('edge-1', 'a', 'b')
    const reconnectedEdge = { ...edge, target: 'c' }
    const restyledEdge = { ...edge, style: { stroke: 'red' } }

    expect(areCanvasPropertyEdgesEqual([edge], [reconnectedEdge])).toBe(true)
    expect(areCanvasPropertyEdgesEqual([edge], [restyledEdge])).toBe(false)
  })
})

function createNode(id: string, zIndex: number): Node {
  return {
    id,
    type: 'text',
    position: { x: 0, y: 0 },
    zIndex,
    data: {},
  }
}

function createEdge(id: string, source: string, target: string): Edge {
  return {
    id,
    source,
    target,
    type: 'bezier',
  }
}
