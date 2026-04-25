import { buildCanvasEdgePath } from './canvas-edge-paths'
import {
  areCanvasSelectionsEqual,
  createInactiveCanvasPendingSelectionPreview,
  createInitialCanvasSelectionState,
  getNextSelectedIds,
  isCanvasPendingPreviewActive,
} from './canvas-selection'
import type {
  CanvasSelectionCommitMode,
  CanvasSelectionGestureKind,
  CanvasSelectionSnapshot,
  CanvasSelectionState,
} from './canvas-selection'
import { createCanvasDomRegistry } from './canvas-dom-registry'
import { createCanvasRenderScheduler } from './canvas-render-scheduler'
import { clearStrokePathCache } from '../nodes/stroke/stroke-path-cache'
import type { CanvasEdgePatch } from '../edges/canvas-edge-types'
import type {
  CanvasDomRegistry,
  CanvasRegisteredEdgePaths,
  CanvasRegisteredStrokeNodePaths,
} from './canvas-dom-registry'
import type {
  CanvasCameraState,
  CanvasRenderScheduler,
  CanvasViewport,
} from './canvas-render-scheduler'
import type { Edge, Node, XYPosition } from '@xyflow/react'

export interface CanvasInternalNode {
  id: string
  node: Node
  positionAbsolute: XYPosition
  measured: {
    width?: number
    height?: number
  }
  selected: boolean
  dragging: boolean
  resizing: boolean
  zIndex: number
  visible: boolean
}

export interface CanvasInternalEdge {
  id: string
  edge: Edge
  selected: boolean
  zIndex: number
  visible: boolean
}

export interface CanvasEngineSnapshot {
  nodes: ReadonlyArray<Node>
  edges: ReadonlyArray<Edge>
  nodeIds: ReadonlyArray<string>
  edgeIds: ReadonlyArray<string>
  nodeLookup: ReadonlyMap<string, CanvasInternalNode>
  edgeLookup: ReadonlyMap<string, CanvasInternalEdge>
  edgeIdsByNodeId: ReadonlyMap<string, ReadonlySet<string>>
  selection: CanvasSelectionState
  selectedNodeIds: ReadonlySet<string>
  selectedEdgeIds: ReadonlySet<string>
  dirtyNodeIds: ReadonlySet<string>
  dirtyEdgeIds: ReadonlySet<string>
  viewport: CanvasViewport
  cameraState: CanvasCameraState
  debouncedZoomLevel: number
  version: number
}

type CanvasEngineListener = () => void
type CanvasViewportCommitListener = (viewport: CanvasViewport) => void
export type CanvasEngineEquality<T> = (a: T, b: T) => boolean
export type { CanvasViewport }

/**
 * CanvasEngine accepts canonical dispatch operations for replayable state changes and direct
 * methods for synchronous local updates. Prefer dispatch({ type: ... }) when the caller needs a
 * serialized operation boundary; use direct methods like setSelection, patchNodes, or setViewport
 * for local runtime work that should execute immediately.
 */
export interface CanvasEngine {
  getSnapshot: () => CanvasEngineSnapshot
  subscribe: (listener: CanvasEngineListener) => () => void
  subscribeViewportCommit: (listener: CanvasViewportCommitListener) => () => void
  subscribeSelector: <T>(
    selector: (snapshot: CanvasEngineSnapshot) => T,
    listener: (next: T, previous: T) => void,
    equality?: CanvasEngineEquality<T>,
  ) => () => void
  dispatch: (operation: CanvasEngineOperation) => void
  setDocumentSnapshot: (snapshot: {
    nodes?: ReadonlyArray<Node>
    edges?: ReadonlyArray<Edge>
  }) => void
  patchNodes: (updates: ReadonlyMap<string, Partial<Node>>) => void
  patchEdges: (updates: ReadonlyMap<string, Partial<Edge>>) => void
  setNodePositions: (positions: ReadonlyMap<string, XYPosition>) => void
  setSelection: (selection: { nodeIds: ReadonlySet<string>; edgeIds: ReadonlySet<string> }) => void
  clearSelection: () => void
  toggleNodeSelection: (nodeId: string, additive: boolean) => void
  toggleEdgeSelection: (edgeId: string, additive: boolean) => void
  beginSelectionGesture: (kind: CanvasSelectionGestureKind, mode: CanvasSelectionCommitMode) => void
  setSelectionGesturePreview: (selection: CanvasSelectionSnapshot | null) => void
  commitSelectionGesture: () => void
  cancelSelectionGesture: () => void
  setViewport: (viewport: CanvasViewport) => void
  setViewportLive: (viewport: CanvasViewport) => void
  getDebouncedZoomLevel: () => number
  getEfficientZoomLevel: () => number
  screenToCanvasPosition: (position: XYPosition, surfaceBounds: DOMRect | null) => XYPosition
  canvasToScreenPosition: (position: XYPosition, surfaceBounds: DOMRect | null) => XYPosition
  startDrag: (nodeIds: ReadonlySet<string>) => void
  updateDrag: (positions: ReadonlyMap<string, XYPosition>) => void
  registerNodeElement: (nodeId: string, element: HTMLElement | null) => () => void
  registerNodeSurfaceElement: (nodeId: string, element: HTMLElement | null) => () => void
  registerStrokeNodePaths: (nodeId: string, paths: CanvasRegisteredStrokeNodePaths) => () => void
  registerEdgeElement: (edgeId: string, element: SVGElement | null) => () => void
  registerEdgePaths: (edgeId: string, paths: CanvasRegisteredEdgePaths) => () => void
  registerViewportElement: (element: HTMLElement | null) => () => void
  registerViewportOverlayElement: (element: HTMLElement | null) => () => void
  scheduleNodeDataPatches: (updates: ReadonlyMap<string, Record<string, unknown>>) => void
  scheduleEdgePatches: (updates: ReadonlyMap<string, CanvasEdgePatch>) => void
  scheduleViewportTransform: (viewport: CanvasViewport) => void
  scheduleCameraState: (state: CanvasCameraState) => void
  flushRenderScheduler: () => void
  stopDrag: () => void
  measureNode: (nodeId: string, dimensions: { width: number; height: number }) => void
  destroy: () => void
}

type CanvasEngineOperation =
  | { type: 'document-snapshot'; nodes?: ReadonlyArray<Node>; edges?: ReadonlyArray<Edge> }
  | { type: 'patch-nodes'; updates: ReadonlyMap<string, Partial<Node>> }
  | { type: 'patch-edges'; updates: ReadonlyMap<string, Partial<Edge>> }
  | { type: 'set-node-positions'; positions: ReadonlyMap<string, XYPosition> }
  | { type: 'set-selection'; nodeIds: ReadonlySet<string>; edgeIds: ReadonlySet<string> }
  | { type: 'clear-selection' }
  | { type: 'toggle-node-selection'; nodeId: string; additive: boolean }
  | { type: 'toggle-edge-selection'; edgeId: string; additive: boolean }
  | {
      type: 'begin-selection-gesture'
      kind: CanvasSelectionGestureKind
      mode: CanvasSelectionCommitMode
    }
  | { type: 'set-selection-gesture-preview'; selection: CanvasSelectionSnapshot | null }
  | { type: 'commit-selection-gesture' }
  | { type: 'cancel-selection-gesture' }
  | { type: 'set-viewport'; viewport: CanvasViewport }
  | { type: 'set-viewport-live'; viewport: CanvasViewport }
  | { type: 'start-drag'; nodeIds: ReadonlySet<string> }
  | { type: 'update-drag'; positions: ReadonlyMap<string, XYPosition> }
  | { type: 'stop-drag' }
  | { type: 'measure-node'; nodeId: string; dimensions: { width: number; height: number } }

const EMPTY_NODES: ReadonlyArray<Node> = []
const EMPTY_EDGES: ReadonlyArray<Edge> = []
const EMPTY_NODE_LOOKUP: ReadonlyMap<string, CanvasInternalNode> = new Map()
const EMPTY_EDGE_LOOKUP: ReadonlyMap<string, CanvasInternalEdge> = new Map()
const EMPTY_EDGE_IDS_BY_NODE_ID: ReadonlyMap<string, ReadonlySet<string>> = new Map()
const EMPTY_IDS: ReadonlyArray<string> = []
const EMPTY_SET: ReadonlySet<string> = new Set()
const DEFAULT_VIEWPORT: CanvasViewport = { x: 0, y: 0, zoom: 1 }
const EFFICIENT_ZOOM_SHAPE_COUNT_THRESHOLD = 500

export function createCanvasEngine(): CanvasEngine {
  const domRegistry: CanvasDomRegistry = createCanvasDomRegistry()
  const renderScheduler: CanvasRenderScheduler = createCanvasRenderScheduler({ domRegistry })
  let snapshot: CanvasEngineSnapshot = {
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
    viewport: DEFAULT_VIEWPORT,
    cameraState: 'idle',
    debouncedZoomLevel: DEFAULT_VIEWPORT.zoom,
    version: 0,
  }
  const listeners = new Set<CanvasEngineListener>()
  const viewportCommitListeners = new Set<CanvasViewportCommitListener>()
  let draggingNodeIds = new Set<string>()
  let hasUncommittedViewport = false

  const emit = () => {
    for (const listener of listeners) {
      listener()
    }
  }

  const emitViewportCommit = (viewport: CanvasViewport) => {
    for (const listener of viewportCommitListeners) {
      listener(viewport)
    }
  }

  const commit = (next: Omit<CanvasEngineSnapshot, 'version'>) => {
    snapshot = {
      ...next,
      version: snapshot.version + 1,
    }
    emit()
  }

  const dispatch = (operation: CanvasEngineOperation) => {
    switch (operation.type) {
      case 'document-snapshot':
        setDocumentSnapshot(operation)
        break
      case 'patch-nodes':
        patchNodes(operation.updates)
        break
      case 'patch-edges':
        patchEdges(operation.updates)
        break
      case 'set-node-positions':
        setNodePositions(operation.positions)
        break
      case 'set-selection':
        setSelection({ nodeIds: operation.nodeIds, edgeIds: operation.edgeIds })
        break
      case 'clear-selection':
        clearSelection()
        break
      case 'toggle-node-selection':
        toggleNodeSelection(operation.nodeId, operation.additive)
        break
      case 'toggle-edge-selection':
        toggleEdgeSelection(operation.edgeId, operation.additive)
        break
      case 'begin-selection-gesture':
        beginSelectionGesture(operation.kind, operation.mode)
        break
      case 'set-selection-gesture-preview':
        setSelectionGesturePreview(operation.selection)
        break
      case 'commit-selection-gesture':
        commitSelectionGesture()
        break
      case 'cancel-selection-gesture':
        cancelSelectionGesture()
        break
      case 'set-viewport':
        setViewport(operation.viewport)
        break
      case 'set-viewport-live':
        setViewportLive(operation.viewport)
        break
      case 'start-drag':
        startDrag(operation.nodeIds)
        break
      case 'update-drag':
        updateDrag(operation.positions)
        break
      case 'stop-drag':
        stopDrag()
        break
      case 'measure-node':
        measureNode(operation.nodeId, operation.dimensions)
        break
      default: {
        const exhaustiveOperation: never = operation
        throw new Error(`Unhandled canvas engine operation: ${String(exhaustiveOperation)}`)
      }
    }
  }

  const setDocumentSnapshot: CanvasEngine['setDocumentSnapshot'] = ({ nodes, edges }) => {
    if (nodes) {
      const nextNodeIds = new Set(nodes.map((node) => node.id))
      for (const node of snapshot.nodes) {
        if (node.type === 'stroke' && !nextNodeIds.has(node.id)) {
          clearStrokePathCache(node.id)
        }
      }
    }

    const nextNodes = nodes ?? snapshot.nodes
    const nextEdges = edges ?? snapshot.edges
    const nodeLookup = createNodeLookup(nextNodes, snapshot.selection.nodeIds, draggingNodeIds)
    const edgeLookup = createEdgeLookup(nextEdges, snapshot.selection.edgeIds)
    const edgeIdsByNodeId = createEdgeAdjacency(nextEdges)

    commit({
      ...snapshot,
      nodes: nextNodes,
      edges: nextEdges,
      nodeIds: nextNodes.map((node) => node.id),
      edgeIds: nextEdges.map((edge) => edge.id),
      nodeLookup,
      edgeLookup,
      edgeIdsByNodeId,
      dirtyNodeIds: nodes ? new Set(nextNodes.map((node) => node.id)) : EMPTY_SET,
      dirtyEdgeIds: edges ? new Set(nextEdges.map((edge) => edge.id)) : EMPTY_SET,
    })
  }

  const patchNodes: CanvasEngine['patchNodes'] = (updates) => {
    if (updates.size === 0) {
      return
    }

    const nextNodes = replaceNodes(snapshot.nodes, updates)
    setDocumentSnapshot({ nodes: nextNodes })
  }

  const patchEdges: CanvasEngine['patchEdges'] = (updates) => {
    if (updates.size === 0) {
      return
    }

    const nextEdges = replaceEdges(snapshot.edges, updates)
    setDocumentSnapshot({ edges: nextEdges })
  }

  const setNodePositions: CanvasEngine['setNodePositions'] = (positions) => {
    if (positions.size === 0) {
      return
    }

    const updates = new Map<string, Partial<Node>>()
    for (const [nodeId, position] of positions) {
      updates.set(nodeId, { position })
    }
    patchNodes(updates)
  }

  const setSelection: CanvasEngine['setSelection'] = ({ nodeIds, edgeIds }) => {
    const nextCommittedSelection = {
      nodeIds,
      edgeIds,
    }

    if (
      areCanvasSelectionsEqual(snapshot.selection, nextCommittedSelection) &&
      snapshot.selection.pendingPreview.kind === 'inactive' &&
      snapshot.selection.gestureKind === null
    ) {
      return
    }

    const nextSelection: CanvasSelectionState = {
      ...snapshot.selection,
      nodeIds: new Set(nodeIds),
      edgeIds: new Set(edgeIds),
      pendingPreview: createInactiveCanvasPendingSelectionPreview(),
      gestureKind: null,
      gestureMode: null,
      gestureStartSelection: null,
    }
    const dirtyNodeIds = getChangedSelectionIds(snapshot.selection.nodeIds, nodeIds)
    const dirtyEdgeIds = getChangedSelectionIds(snapshot.selection.edgeIds, edgeIds)
    const nodeLookup = updateNodeSelectionLookup(snapshot.nodeLookup, nodeIds, dirtyNodeIds)
    const edgeLookup = updateEdgeSelectionLookup(snapshot.edgeLookup, edgeIds, dirtyEdgeIds)

    commit({
      ...snapshot,
      selection: nextSelection,
      selectedNodeIds: nextSelection.nodeIds,
      selectedEdgeIds: nextSelection.edgeIds,
      nodeLookup,
      edgeLookup,
      dirtyNodeIds,
      dirtyEdgeIds,
    })
  }

  const clearSelection: CanvasEngine['clearSelection'] = () => {
    setSelection({ nodeIds: EMPTY_SET, edgeIds: EMPTY_SET })
  }

  const toggleNodeSelection: CanvasEngine['toggleNodeSelection'] = (nodeId, additive) => {
    setSelection({
      nodeIds: getNextSelectedIds({
        selectedIds: snapshot.selection.nodeIds,
        targetId: nodeId,
        additive,
      }),
      edgeIds: additive ? snapshot.selection.edgeIds : EMPTY_SET,
    })
  }

  const toggleEdgeSelection: CanvasEngine['toggleEdgeSelection'] = (edgeId, additive) => {
    setSelection({
      nodeIds: additive ? snapshot.selection.nodeIds : EMPTY_SET,
      edgeIds: getNextSelectedIds({
        selectedIds: snapshot.selection.edgeIds,
        targetId: edgeId,
        additive,
      }),
    })
  }

  const beginSelectionGesture: CanvasEngine['beginSelectionGesture'] = (kind, mode) => {
    const nextSelection: CanvasSelectionState = {
      ...snapshot.selection,
      pendingPreview: createInactiveCanvasPendingSelectionPreview(),
      gestureKind: kind,
      gestureMode: mode,
      gestureStartSelection: {
        nodeIds: snapshot.selection.nodeIds,
        edgeIds: snapshot.selection.edgeIds,
      },
    }

    commit({
      ...snapshot,
      selection: nextSelection,
      selectedNodeIds: nextSelection.nodeIds,
      selectedEdgeIds: nextSelection.edgeIds,
      dirtyNodeIds: EMPTY_SET,
      dirtyEdgeIds: EMPTY_SET,
    })
  }

  const setSelectionGesturePreview: CanvasEngine['setSelectionGesturePreview'] = (selection) => {
    const pendingPreview = selection
      ? {
          kind: 'active' as const,
          nodeIds: new Set(selection.nodeIds),
          edgeIds: new Set(selection.edgeIds),
        }
      : createInactiveCanvasPendingSelectionPreview()
    const previousPreview = snapshot.selection.pendingPreview
    if (
      previousPreview.kind === pendingPreview.kind &&
      (pendingPreview.kind === 'inactive' ||
        (previousPreview.kind === 'active' &&
          areCanvasSelectionsEqual(previousPreview, pendingPreview)))
    ) {
      return
    }

    const nextSelection: CanvasSelectionState = {
      ...snapshot.selection,
      pendingPreview,
    }

    commit({
      ...snapshot,
      selection: nextSelection,
      selectedNodeIds: nextSelection.nodeIds,
      selectedEdgeIds: nextSelection.edgeIds,
      dirtyNodeIds: getChangedPreviewNodeIds(previousPreview, pendingPreview),
      dirtyEdgeIds: getChangedPreviewEdgeIds(previousPreview, pendingPreview),
    })
  }

  const commitSelectionGesture: CanvasEngine['commitSelectionGesture'] = () => {
    const { pendingPreview, gestureMode } = snapshot.selection
    if (isCanvasPendingPreviewActive(pendingPreview)) {
      setSelection({
        nodeIds: pendingPreview.nodeIds,
        edgeIds: pendingPreview.edgeIds,
      })
      return
    }

    if (gestureMode !== null || snapshot.selection.gestureKind !== null) {
      cancelSelectionGesture()
    }
  }

  const cancelSelectionGesture: CanvasEngine['cancelSelectionGesture'] = () => {
    if (
      snapshot.selection.pendingPreview.kind === 'inactive' &&
      snapshot.selection.gestureKind === null
    ) {
      return
    }

    const previousPreview = snapshot.selection.pendingPreview
    const nextSelection: CanvasSelectionState = {
      ...snapshot.selection,
      pendingPreview: createInactiveCanvasPendingSelectionPreview(),
      gestureKind: null,
      gestureMode: null,
      gestureStartSelection: null,
    }

    commit({
      ...snapshot,
      selection: nextSelection,
      selectedNodeIds: nextSelection.nodeIds,
      selectedEdgeIds: nextSelection.edgeIds,
      dirtyNodeIds: getChangedPreviewNodeIds(previousPreview, nextSelection.pendingPreview),
      dirtyEdgeIds: getChangedPreviewEdgeIds(previousPreview, nextSelection.pendingPreview),
    })
  }

  const setViewport: CanvasEngine['setViewport'] = (viewport) => {
    if (
      snapshot.viewport.x === viewport.x &&
      snapshot.viewport.y === viewport.y &&
      snapshot.viewport.zoom === viewport.zoom &&
      !hasUncommittedViewport
    ) {
      return
    }

    hasUncommittedViewport = false
    renderScheduler.scheduleCameraState('idle')
    renderScheduler.scheduleViewportTransform(viewport)
    snapshot = {
      ...snapshot,
      viewport,
      cameraState: 'idle',
      debouncedZoomLevel: viewport.zoom,
      dirtyNodeIds: EMPTY_SET,
      dirtyEdgeIds: EMPTY_SET,
    }
    emitViewportCommit(viewport)
  }

  const setViewportLive: CanvasEngine['setViewportLive'] = (viewport) => {
    if (
      snapshot.viewport.x === viewport.x &&
      snapshot.viewport.y === viewport.y &&
      snapshot.viewport.zoom === viewport.zoom
    ) {
      return
    }

    hasUncommittedViewport = true
    const debouncedZoomLevel =
      snapshot.cameraState === 'idle' ? snapshot.viewport.zoom : snapshot.debouncedZoomLevel
    renderScheduler.scheduleCameraState('moving')
    snapshot = {
      ...snapshot,
      viewport,
      cameraState: 'moving',
      debouncedZoomLevel,
    }
    renderScheduler.scheduleViewportTransform(viewport)
  }

  const getDebouncedZoomLevel: CanvasEngine['getDebouncedZoomLevel'] = () =>
    snapshot.cameraState === 'idle' ? snapshot.viewport.zoom : snapshot.debouncedZoomLevel

  const getEfficientZoomLevel: CanvasEngine['getEfficientZoomLevel'] = () =>
    snapshot.nodes.length + snapshot.edges.length > EFFICIENT_ZOOM_SHAPE_COUNT_THRESHOLD
      ? getDebouncedZoomLevel()
      : snapshot.viewport.zoom

  const screenToCanvasPosition: CanvasEngine['screenToCanvasPosition'] = (
    position,
    surfaceBounds,
  ) => {
    const viewport = snapshot.viewport
    const originX = surfaceBounds?.left ?? 0
    const originY = surfaceBounds?.top ?? 0

    return {
      x: (position.x - originX - viewport.x) / viewport.zoom,
      y: (position.y - originY - viewport.y) / viewport.zoom,
    }
  }

  const canvasToScreenPosition: CanvasEngine['canvasToScreenPosition'] = (
    position,
    surfaceBounds,
  ) => {
    const viewport = snapshot.viewport
    const originX = surfaceBounds?.left ?? 0
    const originY = surfaceBounds?.top ?? 0

    return {
      x: position.x * viewport.zoom + viewport.x + originX,
      y: position.y * viewport.zoom + viewport.y + originY,
    }
  }

  const startDrag: CanvasEngine['startDrag'] = (nodeIds) => {
    draggingNodeIds = new Set(nodeIds)
    commit({
      ...snapshot,
      nodeLookup: createNodeLookup(snapshot.nodes, snapshot.selection.nodeIds, draggingNodeIds),
      dirtyNodeIds: new Set(nodeIds),
      dirtyEdgeIds: EMPTY_SET,
    })
  }

  const updateDrag: CanvasEngine['updateDrag'] = (positions) => {
    if (positions.size === 0) {
      return
    }

    const nextNodeLookup = new Map(snapshot.nodeLookup)
    const dirtyNodeIds = new Set<string>()
    let changed = false

    for (const [nodeId, position] of positions) {
      const existing = nextNodeLookup.get(nodeId)
      if (
        !existing ||
        (existing.node.position.x === position.x && existing.node.position.y === position.y)
      ) {
        continue
      }

      dirtyNodeIds.add(nodeId)
      nextNodeLookup.set(nodeId, {
        ...existing,
        node: { ...existing.node, position },
        positionAbsolute: position,
        dragging: true,
      })
      changed = true
    }

    if (!changed) {
      return
    }

    const nextSnapshot = {
      ...snapshot,
      nodeLookup: nextNodeLookup,
      dirtyNodeIds,
      dirtyEdgeIds: EMPTY_SET,
      version: snapshot.version + 1,
    }
    snapshot = nextSnapshot

    renderScheduler.scheduleNodeTransforms(positions)
    renderScheduler.scheduleEdgePaths(
      getConnectedEdgePaths({
        nodeIds: dirtyNodeIds,
        edgeIdsByNodeId: snapshot.edgeIdsByNodeId,
        edgeLookup: snapshot.edgeLookup,
        nodeLookup: snapshot.nodeLookup,
      }),
    )
  }

  const stopDrag: CanvasEngine['stopDrag'] = () => {
    if (draggingNodeIds.size === 0) {
      return
    }

    const previouslyDragging = draggingNodeIds
    draggingNodeIds = new Set()
    const nextNodes = snapshot.nodes.map((node) => snapshot.nodeLookup.get(node.id)?.node ?? node)
    const nodeLookup = createNodeLookup(nextNodes, snapshot.selection.nodeIds, draggingNodeIds)
    commit({
      ...snapshot,
      nodes: nextNodes,
      nodeLookup,
      dirtyNodeIds: previouslyDragging,
      dirtyEdgeIds: EMPTY_SET,
    })
  }

  const measureNode: CanvasEngine['measureNode'] = (nodeId, dimensions) => {
    const existing = snapshot.nodeLookup.get(nodeId)
    if (
      !existing ||
      (existing.measured.width === dimensions.width &&
        existing.measured.height === dimensions.height)
    ) {
      return
    }

    const nodeWithDimensions = {
      ...existing.node,
      width: dimensions.width,
      height: dimensions.height,
    }
    const nextNodeLookup = new Map(snapshot.nodeLookup)
    nextNodeLookup.set(nodeId, {
      ...existing,
      node: nodeWithDimensions,
      measured: dimensions,
    })

    commit({
      ...snapshot,
      nodeLookup: nextNodeLookup,
      dirtyNodeIds: new Set([nodeId]),
      dirtyEdgeIds: snapshot.edgeIdsByNodeId.get(nodeId) ?? EMPTY_SET,
    })
  }

  const scheduleNodeDataPatches: CanvasEngine['scheduleNodeDataPatches'] = (updates) => {
    if (updates.size === 0) {
      return
    }

    const mergedUpdates = new Map<string, Record<string, unknown>>()
    for (const [nodeId, patch] of updates) {
      const existingData = snapshot.nodeLookup.get(nodeId)?.node.data
      mergedUpdates.set(nodeId, { ...existingData, ...patch })
    }
    renderScheduler.scheduleNodeDataPatches(mergedUpdates)
  }

  const registerViewportElement: CanvasEngine['registerViewportElement'] = (element) => {
    const unregister = domRegistry.registerViewport(element)
    renderScheduler.scheduleCameraState(snapshot.cameraState)
    renderScheduler.scheduleViewportTransform(snapshot.viewport)
    return unregister
  }

  const registerNodeElement: CanvasEngine['registerNodeElement'] = (nodeId, element) => {
    return domRegistry.registerNode(nodeId, element)
  }

  const registerEdgeElement: CanvasEngine['registerEdgeElement'] = (edgeId, element) => {
    return domRegistry.registerEdge(edgeId, element)
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    subscribeViewportCommit: (listener) => {
      viewportCommitListeners.add(listener)
      return () => {
        viewportCommitListeners.delete(listener)
      }
    },
    subscribeSelector: (selector, listener, equality = Object.is) => {
      // This tracks the previous value delivered to the external listener; subscribeWithSelector
      // keeps its own equality state for deciding when that listener should run.
      let selected = selector(snapshot)
      return subscribeWithSelector({
        getSnapshot: () => snapshot,
        subscribe: (selectorListener) => {
          listeners.add(selectorListener)
          return () => {
            listeners.delete(selectorListener)
          }
        },
        selector,
        listener: (next) => {
          const previous = selected
          selected = next
          listener(next, previous)
        },
        equality,
      })
    },
    dispatch,
    setDocumentSnapshot,
    patchNodes,
    patchEdges,
    setNodePositions,
    setSelection,
    clearSelection,
    toggleNodeSelection,
    toggleEdgeSelection,
    beginSelectionGesture,
    setSelectionGesturePreview,
    commitSelectionGesture,
    cancelSelectionGesture,
    setViewport,
    setViewportLive,
    getDebouncedZoomLevel,
    getEfficientZoomLevel,
    screenToCanvasPosition,
    canvasToScreenPosition,
    startDrag,
    updateDrag,
    registerNodeElement,
    registerNodeSurfaceElement: domRegistry.registerNodeSurface,
    registerStrokeNodePaths: domRegistry.registerStrokeNodePaths,
    registerEdgeElement,
    registerEdgePaths: domRegistry.registerEdgePaths,
    registerViewportElement,
    registerViewportOverlayElement: domRegistry.registerViewportOverlay,
    scheduleNodeDataPatches,
    scheduleEdgePatches: renderScheduler.scheduleEdgePatches,
    scheduleViewportTransform: renderScheduler.scheduleViewportTransform,
    scheduleCameraState: renderScheduler.scheduleCameraState,
    flushRenderScheduler: renderScheduler.flush,
    stopDrag,
    measureNode,
    destroy: () => {
      listeners.clear()
      viewportCommitListeners.clear()
      draggingNodeIds = new Set()
      hasUncommittedViewport = false
      renderScheduler.destroy()
      domRegistry.clear()
    },
  }
}

function subscribeWithSelector<T>({
  getSnapshot,
  subscribe,
  selector,
  listener,
  equality,
}: {
  getSnapshot: () => CanvasEngineSnapshot
  subscribe: (listener: CanvasEngineListener) => () => void
  selector: (snapshot: CanvasEngineSnapshot) => T
  listener: (next: T) => void
  equality: CanvasEngineEquality<T>
}) {
  let selected = selector(getSnapshot())
  return subscribe(() => {
    const next = selector(getSnapshot())
    if (equality(selected, next)) {
      return
    }

    selected = next
    listener(next)
  })
}

function createNodeLookup(
  nodes: ReadonlyArray<Node>,
  selectedNodeIds: ReadonlySet<string>,
  draggingNodeIds: ReadonlySet<string>,
): ReadonlyMap<string, CanvasInternalNode> {
  const lookup = new Map<string, CanvasInternalNode>()

  for (const node of nodes) {
    lookup.set(node.id, {
      id: node.id,
      node,
      positionAbsolute: node.position,
      measured: {
        width: node.width,
        height: node.height,
      },
      selected: selectedNodeIds.has(node.id),
      dragging: draggingNodeIds.has(node.id),
      resizing: false,
      zIndex: node.zIndex ?? 0,
      visible: !node.hidden,
    })
  }

  return lookup
}

function createEdgeLookup(
  edges: ReadonlyArray<Edge>,
  selectedEdgeIds: ReadonlySet<string>,
): ReadonlyMap<string, CanvasInternalEdge> {
  const lookup = new Map<string, CanvasInternalEdge>()

  for (const edge of edges) {
    lookup.set(edge.id, {
      id: edge.id,
      edge,
      selected: selectedEdgeIds.has(edge.id),
      zIndex: edge.zIndex ?? 0,
      visible: !edge.hidden,
    })
  }

  return lookup
}

function createEdgeAdjacency(edges: ReadonlyArray<Edge>): ReadonlyMap<string, ReadonlySet<string>> {
  const adjacency = new Map<string, Set<string>>()

  for (const edge of edges) {
    addEdgeAdjacency(adjacency, edge.source, edge.id)
    addEdgeAdjacency(adjacency, edge.target, edge.id)
  }

  return adjacency
}

function addEdgeAdjacency(adjacency: Map<string, Set<string>>, nodeId: string, edgeId: string) {
  const edgeIds = adjacency.get(nodeId) ?? new Set<string>()
  edgeIds.add(edgeId)
  adjacency.set(nodeId, edgeIds)
}

function getConnectedEdgePaths({
  nodeIds,
  edgeIdsByNodeId,
  edgeLookup,
  nodeLookup,
}: {
  nodeIds: ReadonlySet<string>
  edgeIdsByNodeId: ReadonlyMap<string, ReadonlySet<string>>
  edgeLookup: ReadonlyMap<string, CanvasInternalEdge>
  nodeLookup: ReadonlyMap<string, CanvasInternalNode>
}) {
  const paths = new Map<string, string>()

  for (const nodeId of nodeIds) {
    const connectedEdgeIds = edgeIdsByNodeId.get(nodeId)
    if (!connectedEdgeIds) {
      continue
    }

    for (const edgeId of connectedEdgeIds) {
      if (paths.has(edgeId)) {
        continue
      }

      const edge = edgeLookup.get(edgeId)?.edge
      const sourceNode = edge ? nodeLookup.get(edge.source)?.node : null
      const targetNode = edge ? nodeLookup.get(edge.target)?.node : null
      const nodesById =
        sourceNode && targetNode
          ? new Map([
              [sourceNode.id, sourceNode],
              [targetNode.id, targetNode],
            ])
          : null
      const path = edge && nodesById ? buildCanvasEdgePath(edge, nodesById) : null
      if (path) {
        paths.set(edgeId, path)
      }
    }
  }

  return paths
}

function replaceNodes(nodes: ReadonlyArray<Node>, updates: ReadonlyMap<string, Partial<Node>>) {
  let changed = false
  const nextNodes = nodes.map((node) => {
    const patch = updates.get(node.id)
    if (!patch) {
      return node
    }

    if (
      Object.entries(patch).every(
        ([key, value]) => node[key as keyof Node] === (value as Node[keyof Node]),
      )
    ) {
      return node
    }

    const nextNode = { ...node, ...patch }
    changed = true
    return nextNode
  })

  return changed ? nextNodes : nodes
}

function replaceEdges(edges: ReadonlyArray<Edge>, updates: ReadonlyMap<string, Partial<Edge>>) {
  let changed = false
  const nextEdges = edges.map((edge) => {
    const patch = updates.get(edge.id)
    if (!patch) {
      return edge
    }

    const nextEdge = {
      ...edge,
      ...patch,
      style: patch.style ? { ...edge.style, ...patch.style } : edge.style,
    }
    changed ||= nextEdge !== edge
    return nextEdge
  })

  return changed ? nextEdges : edges
}

function getChangedSelectionIds(previous: ReadonlySet<string>, next: ReadonlySet<string>) {
  const changed = new Set<string>()
  for (const id of previous) {
    if (!next.has(id)) {
      changed.add(id)
    }
  }
  for (const id of next) {
    if (!previous.has(id)) {
      changed.add(id)
    }
  }
  return changed
}

function updateNodeSelectionLookup(
  lookup: ReadonlyMap<string, CanvasInternalNode>,
  selectedNodeIds: ReadonlySet<string>,
  changedNodeIds: ReadonlySet<string>,
) {
  if (changedNodeIds.size === 0) {
    return lookup
  }

  const nextLookup = new Map(lookup)
  for (const nodeId of changedNodeIds) {
    const existing = lookup.get(nodeId)
    if (!existing) {
      continue
    }
    nextLookup.set(nodeId, {
      ...existing,
      selected: selectedNodeIds.has(nodeId),
    })
  }
  return nextLookup
}

function updateEdgeSelectionLookup(
  lookup: ReadonlyMap<string, CanvasInternalEdge>,
  selectedEdgeIds: ReadonlySet<string>,
  changedEdgeIds: ReadonlySet<string>,
) {
  if (changedEdgeIds.size === 0) {
    return lookup
  }

  const nextLookup = new Map(lookup)
  for (const edgeId of changedEdgeIds) {
    const existing = lookup.get(edgeId)
    if (!existing) {
      continue
    }
    nextLookup.set(edgeId, {
      ...existing,
      selected: selectedEdgeIds.has(edgeId),
    })
  }
  return nextLookup
}

function getChangedPreviewNodeIds(
  previous: CanvasSelectionState['pendingPreview'],
  next: CanvasSelectionState['pendingPreview'],
) {
  return getChangedSelectionIds(
    previous.kind === 'active' ? previous.nodeIds : EMPTY_SET,
    next.kind === 'active' ? next.nodeIds : EMPTY_SET,
  )
}

function getChangedPreviewEdgeIds(
  previous: CanvasSelectionState['pendingPreview'],
  next: CanvasSelectionState['pendingPreview'],
) {
  return getChangedSelectionIds(
    previous.kind === 'active' ? previous.edgeIds : EMPTY_SET,
    next.kind === 'active' ? next.edgeIds : EMPTY_SET,
  )
}
