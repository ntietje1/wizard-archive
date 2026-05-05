import type {
  CanvasSelectionCommitMode,
  CanvasSelectionGestureKind,
  CanvasSelectionSnapshot,
  CanvasSelectionState,
} from './canvas-selection'
import type { CanvasCameraState } from './canvas-render-scheduler'
import type { CanvasEdgePatch } from '../edges/canvas-edge-types'
import type {
  CanvasDocumentNodePatch,
  CanvasPosition,
  CanvasViewport,
} from '../types/canvas-domain-types'
import type { CanvasDocumentEdge, CanvasDocumentNode } from 'convex/canvases/validation'

export interface CanvasInternalNode {
  id: string
  node: CanvasDocumentNode
  positionAbsolute: CanvasPosition
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
  edge: CanvasDocumentEdge
  selected: boolean
  zIndex: number
  visible: boolean
}

export interface CanvasEngineSnapshot {
  nodes: ReadonlyArray<CanvasDocumentNode>
  edges: ReadonlyArray<CanvasDocumentEdge>
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

export type CanvasEngineListener = () => void
export type CanvasViewportChangeListener = (viewport: CanvasViewport) => void
export type CanvasViewportCommitListener = (viewport: CanvasViewport) => void
export type CanvasEngineEquality<T> = (a: T, b: T) => boolean

export interface CanvasEngine {
  getSnapshot: () => CanvasEngineSnapshot
  subscribe: (listener: CanvasEngineListener) => () => void
  subscribeViewportChange: (listener: CanvasViewportChangeListener) => () => void
  subscribeViewportCommit: (listener: CanvasViewportCommitListener) => () => void
  subscribeSelector: <T>(
    selector: (snapshot: CanvasEngineSnapshot) => T,
    listener: (next: T, previous: T) => void,
    equality?: CanvasEngineEquality<T>,
  ) => () => void
  setDocumentSnapshot: (snapshot: {
    nodes?: ReadonlyArray<CanvasDocumentNode>
    edges?: ReadonlyArray<CanvasDocumentEdge>
  }) => void
  patchNodes: (updates: ReadonlyMap<string, CanvasDocumentNodePatch>) => void
  patchEdges: (updates: ReadonlyMap<string, CanvasEdgePatch>) => void
  setNodePositions: (positions: ReadonlyMap<string, CanvasPosition>) => void
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
  screenToCanvasPosition: (
    position: CanvasPosition,
    surfaceBounds: DOMRect | null,
  ) => CanvasPosition
  canvasToScreenPosition: (
    position: CanvasPosition,
    surfaceBounds: DOMRect | null,
  ) => CanvasPosition
  startDrag: (nodeIds: ReadonlySet<string>) => void
  updateDrag: (positions: ReadonlyMap<string, CanvasPosition>) => void
  stopDrag: () => void
  measureNode: (nodeId: string, dimensions: { width: number; height: number }) => void
  refreshCulling: () => void
  destroy: () => void
}
