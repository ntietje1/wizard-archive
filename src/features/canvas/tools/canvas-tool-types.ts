import type {
  DrawingState,
  Point2D,
  RemoteUser,
  ResizingState,
  SelectingState,
} from '../utils/canvas-awareness-types'
import type { Bounds } from '../utils/canvas-stroke-utils'
import type { Id } from 'convex/_generated/dataModel'
import type { Connection, Edge, Node, XYPosition } from '@xyflow/react'

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

/**
 * Document-level canvas operations for tool modules and sync layers. Prefer this interface for
 * persisted or canvas-wide updates; its `updateNodeData` writes through the document layer, and
 * `resizeNode` commits the final resize rather than handling the transient drag-preview path.
 */
export interface CanvasDocumentActions {
  createNode: (node: Node) => void
  updateNode: (nodeId: string, updater: (node: Node) => Node) => void
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void
  resizeNode: (nodeId: string, width: number, height: number, position: XYPosition) => void
  deleteNodes: (nodeIds: Array<string>) => void
  createEdge: (connection: Connection) => void
  deleteEdges: (edgeIds: Array<string>) => void
  setNodePosition: (nodeId: string, position: XYPosition) => void
  setNodeSelection: (nodeIds: Array<string>) => void
  clearSelection: () => void
  getNodes: () => Array<Node>
  getEdges: () => Array<Edge>
}

export interface CanvasToolRuntime {
  canvasId: Id<'sidebarItems'>
  canEdit: boolean
  getSettings: () => CanvasToolSettings
  getActiveTool: () => CanvasToolId
  setActiveTool: (tool: CanvasToolId) => void
  completeActiveToolAction: () => void
  screenToFlowPosition: (position: XYPosition) => XYPosition
  getZoom: () => number
  document: CanvasDocumentActions
  interaction: {
    getLocalDrawing: () => DrawingState | null
    setLocalDrawing: (drawing: DrawingState | null) => void
    getLassoPath: () => Array<Point2D>
    setLassoPath: (path: Array<Point2D>) => void
    getSelectionRect: () => Bounds | null
    setSelectionRect: (rect: Bounds | null) => void
    setErasingStrokeIds: (ids: Set<string>) => void
    setRectDeselectedIds: (ids: Set<string>) => void
  }
  awareness: {
    setLocalCursor: (position: Point2D | null) => void
    setLocalDragging: (positions: Record<string, Point2D> | null) => void
    setLocalResizing: (resizing: ResizingState | null) => void
    setLocalSelection: (nodeIds: Array<string> | null) => void
    broadcastLocalDrawing: (drawing: DrawingState | null) => void
    setLocalSelecting: (selecting: SelectingState | null) => void
    remoteUsers: Array<RemoteUser>
  }
  editSession: CanvasEditSessionState
}

interface CanvasToolController {
  onPointerDown?: (event: PointerEvent) => void
  onPointerMove?: (event: PointerEvent) => void
  onPointerUp?: (event: PointerEvent) => void
  onPointerCancel?: (event: PointerEvent) => void
  onPaneClick?: (event: React.MouseEvent) => void
  onMoveStart?: (event: MouseEvent | TouchEvent | null) => void
  onMoveEnd?: () => void
}

export interface CanvasToolModule {
  id: CanvasToolId
  label: string
  group: 'selection' | 'creation'
  icon: React.ReactNode
  cursor?: string
  oneShot: boolean
  showsStyleControls: boolean
  create: (runtime: CanvasToolRuntime) => CanvasToolController
}
