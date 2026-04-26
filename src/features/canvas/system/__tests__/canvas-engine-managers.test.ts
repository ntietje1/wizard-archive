import { describe, expect, it, vi } from 'vitest'
import { createInitialCanvasSelectionState } from '../canvas-selection'
import {
  EMPTY_EDGE_IDS_BY_NODE_ID,
  EMPTY_EDGE_LOOKUP,
  EMPTY_EDGES,
  EMPTY_IDS,
  EMPTY_NODE_LOOKUP,
  EMPTY_NODES,
  EMPTY_SET,
  projectCanvasDocumentSnapshot,
} from '../canvas-document-projector'
import { createCanvasCullingManager } from '../canvas-culling-manager'
import { createCanvasGeometryIndex } from '../canvas-geometry-index'
import { createCanvasSelectionManager } from '../canvas-selection-manager'
import { createCanvasStore } from '../canvas-store'
import { createCanvasViewportManager, DEFAULT_CANVAS_VIEWPORT } from '../canvas-viewport-manager'
import type { CanvasEngineSnapshot } from '../canvas-engine-types'
import type { Edge, Node } from '@xyflow/react'

describe('canvas engine managers', () => {
  it('keeps selector notification in the store boundary', () => {
    const snapshot = createSnapshot()
    const store = createCanvasStore(snapshot)
    const listener = vi.fn()
    store.subscribeSelector((next) => next.nodes, listener)

    store.setSnapshot({ ...snapshot, nodes: [createNode('a', 0)] }, { incrementVersion: true })
    expect(listener).not.toHaveBeenCalled()
    expect(store.getSnapshot().version).toBe(1)

    store.setSnapshot(
      { ...store.getSnapshot(), nodes: [createNode('b', 1)] },
      { incrementVersion: true, notify: true },
    )
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot().version).toBe(2)
  })

  it('projects document arrays into ordered ids, lookups, and adjacency', () => {
    const source = { ...createNode('source', 0), width: 100, height: 50 }
    const target = { ...createNode('target', 1), width: 100, height: 50 }
    const edge = createEdge('edge-1', 'source', 'target')

    const projected = projectCanvasDocumentSnapshot({
      snapshot: createSnapshot(),
      nodes: [source, target],
      edges: [edge],
      draggingNodeIds: EMPTY_SET,
    })

    expect(projected.nodeIds).toEqual(['source', 'target'])
    expect(projected.edgeIds).toEqual(['edge-1'])
    expect(projected.nodeLookup.get('source')?.node).toBe(source)
    expect(projected.edgeLookup.get('edge-1')?.edge).toBe(edge)
    expect(projected.edgeIdsByNodeId.get('source')).toEqual(new Set(['edge-1']))
    expect(projected.edgeIdsByNodeId.get('target')).toEqual(new Set(['edge-1']))
  })

  it('keeps selection preview updates out of node and edge lookups', () => {
    const selectionManager = createCanvasSelectionManager()
    const projected = projectCanvasDocumentSnapshot({
      snapshot: createSnapshot(),
      nodes: [createNode('a', 0), createNode('b', 1)],
      edges: [createEdge('edge-1', 'a', 'b')],
      draggingNodeIds: EMPTY_SET,
    }) as CanvasEngineSnapshot

    const gesture = selectionManager.beginGesture(projected, 'lasso', 'replace')
    expect(gesture).not.toBeNull()
    const preview = selectionManager.setGesturePreview(gesture as CanvasEngineSnapshot, {
      nodeIds: new Set(['b']),
      edgeIds: new Set(['edge-1']),
    })
    expect(preview).not.toBeNull()
    const committed = selectionManager.commitGesture(preview as CanvasEngineSnapshot)

    expect(preview?.nodeLookup).toBe(projected.nodeLookup)
    expect(preview?.edgeLookup).toBe(projected.edgeLookup)
    expect(committed?.selection.nodeIds).toEqual(new Set(['b']))
    expect(committed?.selection.edgeIds).toEqual(new Set(['edge-1']))
  })

  it('converts coordinates from the engine-owned viewport', () => {
    const viewportManager = createCanvasViewportManager()
    const snapshot = {
      ...createSnapshot(),
      viewport: { x: 10, y: 20, zoom: 2 },
    }
    const surfaceBounds = { left: 100, top: 50 } as DOMRect

    expect(
      viewportManager.screenToCanvasPosition(snapshot, { x: 130, y: 90 }, surfaceBounds),
    ).toEqual({ x: 10, y: 10 })
    expect(
      viewportManager.canvasToScreenPosition(snapshot, { x: 10, y: 10 }, surfaceBounds),
    ).toEqual({ x: 130, y: 90 })
  })

  it('computes connected edge paths from geometry state without mutating document arrays', () => {
    const geometryIndex = createCanvasGeometryIndex()
    const projected = projectCanvasDocumentSnapshot({
      snapshot: createSnapshot(),
      nodes: [
        { ...createNode('source', 0), width: 100, height: 50 },
        { ...createNode('target', 1), position: { x: 200, y: 0 }, width: 100, height: 50 },
      ],
      edges: [createEdge('edge-1', 'source', 'target')],
      draggingNodeIds: EMPTY_SET,
    }) as CanvasEngineSnapshot
    const nodesBefore = projected.nodes

    const update = geometryIndex.updateDraggedNodePositions(
      projected,
      new Map([['source', { x: 20, y: 10 }]]),
    )
    expect(update).not.toBeNull()
    const paths = geometryIndex.getConnectedEdgePaths(
      update?.snapshot as CanvasEngineSnapshot,
      new Set(['source']),
    )

    expect(update?.snapshot.nodes).toBe(nodesBefore)
    expect(paths.get('edge-1')).toBeTruthy()
  })

  it('returns culling diffs without changing render ids', () => {
    const cullingManager = createCanvasCullingManager()
    const projected = projectCanvasDocumentSnapshot({
      snapshot: createSnapshot(),
      nodes: [
        { ...createNode('inside', 0), width: 20, height: 20 },
        { ...createNode('far', 1), position: { x: 2000, y: 0 }, width: 20, height: 20 },
      ],
      draggingNodeIds: EMPTY_SET,
    }) as CanvasEngineSnapshot

    const diff = cullingManager.reconcile({
      snapshot: projected,
      surfaceBounds: { width: 100, height: 100 },
      draggingNodeIds: EMPTY_SET,
    })

    expect(projected.nodeIds).toEqual(['inside', 'far'])
    expect(diff?.nodeIds).toEqual(new Map([['far', true]]))
  })
})

function createSnapshot(): CanvasEngineSnapshot {
  return {
    nodes: EMPTY_NODES,
    edges: EMPTY_EDGES,
    nodeIds: EMPTY_IDS,
    edgeIds: EMPTY_IDS,
    nodeLookup: EMPTY_NODE_LOOKUP,
    edgeLookup: EMPTY_EDGE_LOOKUP,
    edgeIdsByNodeId: EMPTY_EDGE_IDS_BY_NODE_ID,
    selection: createInitialCanvasSelectionState(),
    selectedNodeIds: EMPTY_SET,
    selectedEdgeIds: EMPTY_SET,
    dirtyNodeIds: EMPTY_SET,
    dirtyEdgeIds: EMPTY_SET,
    viewport: DEFAULT_CANVAS_VIEWPORT,
    cameraState: 'idle',
    debouncedZoomLevel: DEFAULT_CANVAS_VIEWPORT.zoom,
    version: 0,
  }
}

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
