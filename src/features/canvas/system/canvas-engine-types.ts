import type {
  CanvasSelectionCommitMode,
  CanvasSelectionGestureKind,
  CanvasSelectionSnapshot,
  CanvasSelectionState,
} from './canvas-selection'
import type { CanvasCameraState, CanvasViewport } from './canvas-render-scheduler'
import type { CanvasEdgePatch } from '../edges/canvas-edge-types'
import type {
  CanvasRegisteredEdgePaths,
  CanvasRegisteredStrokeNodePaths,
} from './canvas-dom-registry'
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

export type CanvasEngineListener = () => void
export type CanvasViewportCommitListener = (viewport: CanvasViewport) => void
export type CanvasEngineEquality<T> = (a: T, b: T) => boolean

export interface CanvasEngine {
  getSnapshot: () => CanvasEngineSnapshot
  subscribe: (listener: CanvasEngineListener) => () => void
  subscribeViewportCommit: (listener: CanvasViewportCommitListener) => () => void
  subscribeSelector: <T>(
    selector: (snapshot: CanvasEngineSnapshot) => T,
    listener: (next: T, previous: T) => void,
    equality?: CanvasEngineEquality<T>,
  ) => () => void
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

export type { CanvasViewport }
