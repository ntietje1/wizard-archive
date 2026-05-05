import { createInitialCanvasSelectionState } from './canvas-selection'
import {
  EMPTY_EDGE_IDS_BY_NODE_ID,
  EMPTY_EDGE_LOOKUP,
  EMPTY_EDGES,
  EMPTY_IDS,
  EMPTY_NODE_LOOKUP,
  EMPTY_NODES,
  EMPTY_SET,
  createNodeLookup,
  patchCanvasEdges,
  patchCanvasNodes,
  projectCanvasDocumentSnapshot,
} from './canvas-document-projector'
import { clearStrokePathCache } from '../nodes/stroke/stroke-path-cache'
import { createCanvasCullingManager } from './canvas-culling-manager'
import { createCanvasDomRuntime } from './canvas-dom-runtime'
import { createCanvasGeometryIndex } from './canvas-geometry-index'
import { createCanvasSelectionManager } from './canvas-selection-manager'
import { createCanvasStore } from './canvas-store'
import { createCanvasViewportManager, DEFAULT_CANVAS_VIEWPORT } from './canvas-viewport-manager'
import type { CanvasDomRuntime } from './canvas-dom-runtime'
import type { CanvasEngine, CanvasEngineSnapshot } from './canvas-engine-types'
import type { CanvasDocumentNodePatch } from '../types/canvas-domain-types'
import type { CanvasDocumentNode } from 'convex/canvases/validation'

export function createCanvasEngine(config: { domRuntime?: CanvasDomRuntime } = {}): CanvasEngine {
  const ownsDomRuntime = !config.domRuntime
  const domRuntime = config.domRuntime ?? createCanvasDomRuntime()
  const store = createCanvasStore(createInitialCanvasEngineSnapshot())
  const selectionManager = createCanvasSelectionManager()
  const viewportManager = createCanvasViewportManager()
  const geometryIndex = createCanvasGeometryIndex()
  const cullingManager = createCanvasCullingManager()
  let draggingNodeIds = new Set<string>()

  const reconcileCulling = () => {
    const diff = cullingManager.reconcile({
      snapshot: store.getSnapshot(),
      surfaceBounds: domRuntime.getViewportSurfaceBounds(),
      draggingNodeIds,
    })

    if (diff) {
      domRuntime.scheduleCullingDiff(diff)
    }
  }

  const commit = (next: Omit<CanvasEngineSnapshot, 'version'>) => {
    store.setSnapshot(next, { incrementVersion: true })
    reconcileCulling()
    store.notify()
  }

  const setRuntimeSnapshot = (
    next: Omit<CanvasEngineSnapshot, 'version'>,
    options: { incrementVersion?: boolean } = {},
  ) => {
    store.setSnapshot(next, { incrementVersion: options.incrementVersion })
    reconcileCulling()
  }

  const setDocumentSnapshot: CanvasEngine['setDocumentSnapshot'] = ({ nodes, edges }) => {
    clearRemovedStrokePathCache(store.getSnapshot().nodes, nodes)
    commit(
      projectCanvasDocumentSnapshot({
        snapshot: store.getSnapshot(),
        nodes,
        edges,
        draggingNodeIds,
      }),
    )
  }

  const patchNodes: CanvasEngine['patchNodes'] = (updates) => {
    if (updates.size === 0) {
      return
    }

    const snapshot = store.getSnapshot()
    const nextNodes = patchCanvasNodes(snapshot.nodes, updates)
    if (nextNodes === snapshot.nodes) {
      return
    }

    setDocumentSnapshot({ nodes: nextNodes })
  }

  const patchEdges: CanvasEngine['patchEdges'] = (updates) => {
    if (updates.size === 0) {
      return
    }

    const snapshot = store.getSnapshot()
    const nextEdges = patchCanvasEdges(snapshot.edges, updates)
    if (nextEdges === snapshot.edges) {
      return
    }

    setDocumentSnapshot({ edges: nextEdges })
  }

  const setNodePositions: CanvasEngine['setNodePositions'] = (positions) => {
    if (positions.size === 0) {
      return
    }

    const updates = new Map<string, CanvasDocumentNodePatch>()
    for (const [nodeId, position] of positions) {
      updates.set(nodeId, { position })
    }
    patchNodes(updates)
  }

  const applySelectionUpdate = (next: Omit<CanvasEngineSnapshot, 'version'> | null) => {
    if (next) {
      commit(next)
    }
  }

  const setViewport: CanvasEngine['setViewport'] = (viewport) => {
    const next = viewportManager.setViewport(store.getSnapshot(), viewport)
    if (!next) {
      return
    }

    domRuntime.scheduleCameraState('idle')
    domRuntime.scheduleViewportTransform(viewport)
    setRuntimeSnapshot(next)
    store.emitViewportChange(viewport)
    store.emitViewportCommit(viewport)
  }

  const setViewportLive: CanvasEngine['setViewportLive'] = (viewport) => {
    const next = viewportManager.setViewportLive(store.getSnapshot(), viewport)
    if (!next) {
      return
    }

    domRuntime.scheduleCameraState('moving')
    domRuntime.scheduleViewportTransform(viewport)
    setRuntimeSnapshot(next)
    store.emitViewportChange(viewport)
  }

  const startDrag: CanvasEngine['startDrag'] = (nodeIds) => {
    draggingNodeIds = new Set(nodeIds)
    const snapshot = store.getSnapshot()
    commit({
      ...snapshot,
      nodeLookup: createNodeLookup(snapshot.nodes, snapshot.selection.nodeIds, draggingNodeIds),
      dirtyNodeIds: new Set(nodeIds),
      dirtyEdgeIds: EMPTY_SET,
    })
  }

  const updateDrag: CanvasEngine['updateDrag'] = (positions) => {
    const update = geometryIndex.updateDraggedNodePositions(store.getSnapshot(), positions)
    if (!update) {
      return
    }

    setRuntimeSnapshot(update.snapshot, { incrementVersion: true })
    domRuntime.scheduleNodeTransforms(positions)
    domRuntime.scheduleEdgePaths(
      geometryIndex.getConnectedEdgePaths(store.getSnapshot(), update.dirtyNodeIds),
    )
  }

  const stopDrag: CanvasEngine['stopDrag'] = () => {
    if (draggingNodeIds.size === 0) {
      return
    }

    const previouslyDragging = draggingNodeIds
    draggingNodeIds = new Set()
    commit(geometryIndex.stopDrag(store.getSnapshot(), previouslyDragging, draggingNodeIds))
  }

  const measureNode: CanvasEngine['measureNode'] = (nodeId, dimensions) => {
    const update = geometryIndex.measureNode(store.getSnapshot(), nodeId, dimensions)
    if (!update) {
      return
    }

    if (update.notify) {
      commit(update.snapshot)
      return
    }

    setRuntimeSnapshot(update.snapshot)
  }

  return {
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    subscribeViewportChange: store.subscribeViewportChange,
    subscribeViewportCommit: store.subscribeViewportCommit,
    subscribeSelector: store.subscribeSelector,
    setDocumentSnapshot,
    patchNodes,
    patchEdges,
    setNodePositions,
    setSelection: (selection) =>
      applySelectionUpdate(selectionManager.setSelection(store.getSnapshot(), selection)),
    clearSelection: () =>
      applySelectionUpdate(selectionManager.clearSelection(store.getSnapshot())),
    toggleNodeSelection: (nodeId, additive) =>
      applySelectionUpdate(
        selectionManager.toggleNodeSelection(store.getSnapshot(), nodeId, additive),
      ),
    toggleEdgeSelection: (edgeId, additive) =>
      applySelectionUpdate(
        selectionManager.toggleEdgeSelection(store.getSnapshot(), edgeId, additive),
      ),
    beginSelectionGesture: (kind, mode) =>
      applySelectionUpdate(selectionManager.beginGesture(store.getSnapshot(), kind, mode)),
    setSelectionGesturePreview: (selection) =>
      applySelectionUpdate(selectionManager.setGesturePreview(store.getSnapshot(), selection)),
    commitSelectionGesture: () =>
      applySelectionUpdate(selectionManager.commitGesture(store.getSnapshot())),
    cancelSelectionGesture: () =>
      applySelectionUpdate(selectionManager.cancelGesture(store.getSnapshot())),
    setViewport,
    setViewportLive,
    getDebouncedZoomLevel: () => viewportManager.getDebouncedZoomLevel(store.getSnapshot()),
    getEfficientZoomLevel: () => viewportManager.getEfficientZoomLevel(store.getSnapshot()),
    screenToCanvasPosition: (position, surfaceBounds) =>
      viewportManager.screenToCanvasPosition(store.getSnapshot(), position, surfaceBounds),
    canvasToScreenPosition: (position, surfaceBounds) =>
      viewportManager.canvasToScreenPosition(store.getSnapshot(), position, surfaceBounds),
    startDrag,
    updateDrag,
    stopDrag,
    measureNode,
    refreshCulling: reconcileCulling,
    destroy: () => {
      store.destroy()
      draggingNodeIds = new Set()
      viewportManager.reset()
      cullingManager.reset()
      if (ownsDomRuntime) {
        domRuntime.destroy()
      }
    },
  }
}

function createInitialCanvasEngineSnapshot(): CanvasEngineSnapshot {
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

function clearRemovedStrokePathCache(
  previousNodes: ReadonlyArray<CanvasDocumentNode>,
  nextNodes: ReadonlyArray<CanvasDocumentNode> | undefined,
) {
  if (!nextNodes) {
    return
  }

  let nextNodeIds: Set<string> | null = null
  for (const node of previousNodes) {
    if (node.type !== 'stroke') {
      continue
    }

    nextNodeIds ??= new Set(nextNodes.map((nextNode) => nextNode.id))
    if (!nextNodeIds.has(node.id)) {
      clearStrokePathCache(node.id)
    }
  }
}
