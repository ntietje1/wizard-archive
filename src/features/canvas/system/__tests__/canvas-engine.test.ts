import { describe, expect, it, vi } from 'vitest'
import { createCanvasEngine } from '../canvas-engine'
import {
  areCanvasPropertyEdgesEqual,
  areCanvasPropertyNodesEqual,
  areCanvasEdgeEndpointNodesEqual,
  selectCanvasEdgeEndpointNodes,
} from '../canvas-engine-selectors'
import type {
  CanvasEdge as Edge,
  CanvasNode as Node,
} from '~/features/canvas/types/canvas-domain-types'

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

  it('skips projection and notification for unchanged engine patches', () => {
    const engine = createCanvasEngine()
    engine.setDocumentSnapshot({
      nodes: [createNode('a', 0)],
      edges: [createEdge('edge-1', 'a', 'a')],
    })
    const version = engine.getSnapshot().version
    const listener = vi.fn()
    engine.subscribe(listener)

    engine.patchNodes(new Map([['a', { zIndex: 0 }]]))
    engine.patchEdges(new Map([['edge-1', { type: 'bezier' }]]))
    engine.setNodePositions(new Map([['a', { x: 0, y: 0 }]]))

    expect(listener).not.toHaveBeenCalled()
    expect(engine.getSnapshot().version).toBe(version)
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

  it('updates viewport transforms without notifying general subscribers', () => {
    const engine = createCanvasEngine()
    const viewportElement = document.createElement('div')
    const unregister = engine.registerViewportElement(viewportElement)
    const listener = vi.fn()
    const unsubscribe = engine.subscribe(listener)
    const viewportListener = vi.fn()
    const unsubscribeViewport = engine.subscribeViewportCommit(viewportListener)

    engine.setViewportLive({ x: 10, y: 20, zoom: 2 })
    engine.flushRenderScheduler()

    expect(listener).not.toHaveBeenCalled()
    expect(viewportListener).not.toHaveBeenCalled()
    expect(engine.getSnapshot().viewport).toEqual({ x: 10, y: 20, zoom: 2 })
    expect(engine.getSnapshot().cameraState).toBe('moving')
    expect(engine.getSnapshot().debouncedZoomLevel).toBe(1)
    expect(engine.getDebouncedZoomLevel()).toBe(1)
    expect(viewportElement.style.transform).toBe('translate3d(10px, 20px, 0) scale(2)')
    expect(viewportElement).toHaveAttribute('data-camera-state', 'moving')
    expect(viewportElement.style.willChange).toBe('transform')

    engine.setViewport({ x: 10, y: 20, zoom: 2 })
    engine.flushRenderScheduler()
    expect(listener).not.toHaveBeenCalled()
    expect(viewportListener).toHaveBeenCalledTimes(1)
    expect(viewportListener).toHaveBeenCalledWith({ x: 10, y: 20, zoom: 2 })
    expect(engine.getSnapshot().cameraState).toBe('idle')
    expect(engine.getSnapshot().debouncedZoomLevel).toBe(2)
    expect(engine.getDebouncedZoomLevel()).toBe(2)
    expect(viewportElement).toHaveAttribute('data-camera-state', 'idle')
    expect(viewportElement.style.willChange).toBe('')

    unsubscribe()
    unsubscribeViewport()
    unregister()
    engine.destroy()
  })

  it('culls offscreen registered elements without mutating ordered ids or notifying subscribers', () => {
    const engine = createCanvasEngine()
    const paneElement = document.createElement('div')
    const viewportElement = document.createElement('div')
    paneElement.append(viewportElement)
    Object.defineProperties(paneElement, {
      clientWidth: { value: 100 },
      clientHeight: { value: 100 },
    })
    paneElement.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect
    const insideElement = document.createElement('div')
    const farElement = document.createElement('div')
    const unregisterViewport = engine.registerViewportElement(viewportElement)
    const unregisterInside = engine.registerNodeElement('inside', insideElement)
    const unregisterFar = engine.registerNodeElement('far', farElement)
    const listener = vi.fn()
    const unsubscribe = engine.subscribe(listener)

    engine.setDocumentSnapshot({
      nodes: [
        { ...createNode('inside', 0), width: 20, height: 20 },
        { ...createNode('far', 1), position: { x: 800, y: 0 }, width: 20, height: 20 },
      ],
    })
    engine.flushRenderScheduler()

    expect(engine.getSnapshot().nodeIds).toEqual(['inside', 'far'])
    expect(insideElement.style.display).toBe('')
    expect(farElement.style.display).toBe('none')
    expect(farElement).toHaveAttribute('data-canvas-culled', 'true')

    listener.mockClear()
    engine.setViewportLive({ x: -700, y: 0, zoom: 1 })
    engine.flushRenderScheduler()

    expect(listener).not.toHaveBeenCalled()
    expect(engine.getSnapshot().nodeIds).toEqual(['inside', 'far'])
    expect(insideElement.style.display).toBe('none')
    expect(farElement.style.display).toBe('')

    engine.setViewport({ x: -700, y: 0, zoom: 1 })
    engine.flushRenderScheduler()

    expect(listener).not.toHaveBeenCalled()
    expect(engine.getSnapshot().nodeIds).toEqual(['inside', 'far'])
    expect(farElement.style.display).toBe('')

    unsubscribe()
    unregisterViewport()
    unregisterInside()
    unregisterFar()
    engine.destroy()
  })

  it('applies the current culling state when an element registers after reconciliation', () => {
    const engine = createCanvasEngine()
    const paneElement = document.createElement('div')
    const viewportElement = document.createElement('div')
    paneElement.append(viewportElement)
    paneElement.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect
    const unregisterViewport = engine.registerViewportElement(viewportElement)

    engine.setDocumentSnapshot({
      nodes: [{ ...createNode('far', 0), position: { x: 800, y: 0 }, width: 20, height: 20 }],
    })
    engine.flushRenderScheduler()

    const farElement = document.createElement('div')
    const unregisterFar = engine.registerNodeElement('far', farElement)

    expect(farElement.style.display).toBe('none')
    expect(farElement).toHaveAttribute('data-canvas-culled', 'true')

    unregisterFar()
    unregisterViewport()
    engine.destroy()
  })

  it('uses measured node dimensions when document dimensions are absent', () => {
    const engine = createCanvasEngine()
    const paneElement = document.createElement('div')
    const viewportElement = document.createElement('div')
    paneElement.append(viewportElement)
    paneElement.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect
    const measuredElement = document.createElement('div')
    const unregisterViewport = engine.registerViewportElement(viewportElement)
    const unregisterMeasured = engine.registerNodeElement('measured', measuredElement)
    engine.setDocumentSnapshot({
      nodes: [{ ...createNode('measured', 0), position: { x: 800, y: 0 } }],
    })
    engine.flushRenderScheduler()

    expect(measuredElement.style.display).toBe('')

    engine.measureNode('measured', { width: 20, height: 20 })
    engine.flushRenderScheduler()

    expect(measuredElement.style.display).toBe('none')

    unregisterMeasured()
    unregisterViewport()
    engine.destroy()
  })

  it('stores measurements for dimensioned nodes without notifying general subscribers', () => {
    const engine = createCanvasEngine()
    const listener = vi.fn()
    engine.setDocumentSnapshot({
      nodes: [{ ...createNode('dimensioned', 0), width: 20, height: 20 }],
    })
    engine.subscribe(listener)

    engine.measureNode('dimensioned', { width: 20, height: 20 })

    expect(listener).not.toHaveBeenCalled()
    expect(engine.getSnapshot().nodeLookup.get('dimensioned')?.measured).toEqual({
      width: 20,
      height: 20,
    })

    engine.destroy()
  })

  it('keeps selected offscreen nodes and connected edges visible', () => {
    const engine = createCanvasEngine()
    const paneElement = document.createElement('div')
    const viewportElement = document.createElement('div')
    paneElement.append(viewportElement)
    paneElement.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect
    const sourceElement = document.createElement('div')
    const targetElement = document.createElement('div')
    const edgeElement = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    const unregisterViewport = engine.registerViewportElement(viewportElement)
    const unregisterSource = engine.registerNodeElement('source', sourceElement)
    const unregisterTarget = engine.registerNodeElement('target', targetElement)
    const unregisterEdge = engine.registerEdgeElement('edge-1', edgeElement)

    engine.setDocumentSnapshot({
      nodes: [
        { ...createNode('source', 0), position: { x: 800, y: 0 }, width: 20, height: 20 },
        { ...createNode('target', 1), position: { x: 900, y: 0 }, width: 20, height: 20 },
      ],
      edges: [createEdge('edge-1', 'source', 'target')],
    })
    engine.flushRenderScheduler()

    expect(sourceElement.style.display).toBe('none')
    expect(edgeElement.style.display).toBe('none')

    engine.setSelection({ nodeIds: new Set(['source']), edgeIds: new Set() })
    engine.flushRenderScheduler()

    expect(sourceElement.style.display).toBe('')
    expect(edgeElement.style.display).toBe('')
    expect(targetElement.style.display).toBe('none')

    unregisterEdge()
    unregisterTarget()
    unregisterSource()
    unregisterViewport()
    engine.destroy()
  })

  it('updates registered viewport overlay transforms with the main viewport', () => {
    const engine = createCanvasEngine()
    const viewportElement = document.createElement('div')
    const localOverlayElement = document.createElement('div')
    const awarenessOverlayElement = document.createElement('div')

    const unregisterViewport = engine.registerViewportElement(viewportElement)
    const unregisterLocalOverlay = engine.registerViewportOverlayElement(localOverlayElement)
    const unregisterAwarenessOverlay =
      engine.registerViewportOverlayElement(awarenessOverlayElement)

    engine.setViewportLive({ x: 15, y: -25, zoom: 1.5 })
    engine.flushRenderScheduler()

    expect(viewportElement.style.transform).toBe('translate3d(15px, -25px, 0) scale(1.5)')
    expect(localOverlayElement.style.transform).toBe('translate3d(15px, -25px, 0) scale(1.5)')
    expect(awarenessOverlayElement.style.transform).toBe('translate3d(15px, -25px, 0) scale(1.5)')

    unregisterViewport()
    unregisterLocalOverlay()
    unregisterAwarenessOverlay()
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
