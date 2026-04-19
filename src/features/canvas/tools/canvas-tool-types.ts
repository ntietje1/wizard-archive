import type {
  DrawingState,
  Point2D,
  ResizingState,
  RemoteUser,
  SelectingState,
} from '../utils/canvas-awareness-types'
import type { CanvasInspectableProperties } from '../properties/canvas-property-types'
import type { Connection, Edge, Node, XYPosition } from '@xyflow/react'
import type { ComponentType, MouseEvent as ReactMouseEvent, ReactNode } from 'react'

export type CanvasToolId =
  | 'select'
  | 'hand'
  | 'draw'
  | 'erase'
  | 'lasso'
  | 'rectangle'
  | 'text'
  | 'sticky'

interface CanvasToolSettings {
  strokeColor: string
  strokeOpacity: number
  strokeSize: number
}

export interface CanvasHistoryController {
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

export interface CanvasEditSessionState {
  editingEmbedId: string | null
  setEditingEmbedId: (id: string | null) => void
  pendingEditNodeId: string | null
  setPendingEditNodeId: (id: string | null) => void
}

/**
 * Per-node UI callbacks for node components. Prefer this interface inside node renderers for
 * immediate interaction updates; `updateNodeData` applies local node-level changes, while
 * `onResize` and `onResizeEnd` separate live resize feedback from the committed resize write.
 */
export interface CanvasNodeActions {
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void
  onResize: (nodeId: string, width: number, height: number, position: XYPosition) => void
  onResizeEnd: (nodeId: string, width: number, height: number, position: XYPosition) => void
}

export interface CanvasDocumentWriter {
  createNode: (node: Node) => void
  updateNode: (nodeId: string, updater: (node: Node) => Node) => void
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void
  resizeNode: (nodeId: string, width: number, height: number, position: XYPosition) => void
  deleteNodes: (nodeIds: Array<string>) => void
  createEdge: (connection: Connection) => void
  deleteEdges: (edgeIds: Array<string>) => void
  setNodePosition: (nodeId: string, position: XYPosition) => void
}

export interface CanvasDocumentReader {
  getNodes: () => Array<Node>
  getEdges: () => Array<Edge>
}

export type CanvasMeasuredNode = Node & {
  width: number
  height: number
}

interface CanvasMeasuredNodeReader {
  getMeasuredNodes: () => Array<CanvasMeasuredNode>
}

export interface CanvasSelectionActions {
  setNodeSelection: (nodeIds: Array<string>) => void
  clearSelection: () => void
  getSelectedNodeIds: () => Array<string>
}

export interface CanvasViewportTools {
  screenToFlowPosition: (position: XYPosition) => XYPosition
  getZoom: () => number
}

export interface CanvasToolStateControls {
  getSettings: () => CanvasToolSettings
  getActiveTool: () => CanvasToolId
  setActiveTool: (tool: CanvasToolId) => void
  setStrokeColor: (color: string) => void
  setStrokeSize: (size: number) => void
  setStrokeOpacity: (opacity: number) => void
}

export interface CanvasToolPropertyContext {
  toolState: Pick<
    CanvasToolStateControls,
    'getSettings' | 'setStrokeColor' | 'setStrokeSize' | 'setStrokeOpacity'
  >
}

interface CanvasInteractionOverlayControls {
  setLocalDrawing: (drawing: DrawingState | null) => void
  setLassoPath: (path: Array<Point2D>) => void
  setSelectionDragRect: (
    rect: {
      x: number
      y: number
      width: number
      height: number
    } | null,
  ) => void
  setErasingStrokeIds: (ids: Set<string>) => void
  setRectDeselectedIds: (ids: Set<string>) => void
}

export interface CanvasAwarenessWriter {
  setLocalCursor: (position: Point2D | null) => void
  setLocalDragging: (positions: Record<string, Point2D> | null) => void
  setLocalResizing: (resizing: ResizingState | null) => void
  setLocalSelection: (nodeIds: Array<string> | null) => void
  setLocalDrawing: (drawing: DrawingState | null) => void
  setLocalSelecting: (selecting: SelectingState | null) => void
}

export interface CanvasAwarenessCapability {
  Layer?: ComponentType<{ remoteUsers: Array<RemoteUser> }>
}

export interface CanvasToolEnvironment {
  viewport: CanvasViewportTools
  document: CanvasDocumentWriter & CanvasDocumentReader & CanvasMeasuredNodeReader
  selection: CanvasSelectionActions
  editSession: CanvasEditSessionState
  toolState: CanvasToolStateControls
  interaction: CanvasInteractionOverlayControls
  awareness: CanvasAwarenessWriter
}

export interface CanvasToolController {
  onPointerDown?: (event: PointerEvent) => void
  onPointerMove?: (event: PointerEvent) => void
  onPointerUp?: (event: PointerEvent) => void
  onPointerCancel?: (event: PointerEvent) => void
  onNodeClick?: (event: ReactMouseEvent, node: Node) => void
  onPaneClick?: (event: ReactMouseEvent) => void
  onMoveStart?: (event: MouseEvent | TouchEvent | null) => void
  onMoveEnd?: () => void
}

export interface CanvasToolModule<TId extends CanvasToolId = CanvasToolId> {
  id: TId
  label: string
  group: 'selection' | 'creation'
  icon: ReactNode
  cursor?: string
  properties?: (context: CanvasToolPropertyContext) => CanvasInspectableProperties
  awareness?: CanvasAwarenessCapability
  create: (environment: CanvasToolEnvironment) => CanvasToolController
}

export type AnyCanvasToolModule = {
  [TId in CanvasToolId]: CanvasToolModule<TId>
}[CanvasToolId]
