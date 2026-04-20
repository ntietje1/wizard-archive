import type {
  CanvasAwarenessNamespace,
  Point2D,
  ResizingState,
  RemoteUser,
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

export type CanvasSelectionGestureKind = 'marquee' | 'lasso'
export type CanvasSelectionCommitMode = 'replace' | 'add'

export interface CanvasSelectionSnapshot {
  nodeIds: Array<string>
  edgeIds: Array<string>
}

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

export interface CanvasSelectionController {
  replace: (selection: CanvasSelectionSnapshot) => void
  replaceNodes: (nodeIds: Array<string>) => void
  replaceEdges: (edgeIds: Array<string>) => void
  clear: () => void
  getSelectedNodeIds: () => Array<string>
  getSelectedEdgeIds: () => Array<string>
  toggleNodeFromTarget: (targetId: string | null, toggle: boolean) => void
  toggleEdgeFromTarget: (targetId: string | null, toggle: boolean) => void
  beginGesture: (kind: CanvasSelectionGestureKind) => void
  commitGestureSelection: (
    selection: CanvasSelectionSnapshot,
    mode?: CanvasSelectionCommitMode,
  ) => void
  endGesture: () => void
}

export interface CanvasInteractionTools {
  suppressNextSurfaceClick: () => void
}

export interface CanvasModifierKeyReader {
  getShiftPressed: () => boolean
  getPrimaryPressed: () => boolean
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

export interface CanvasCoreAwarenessWriter {
  setLocalCursor: (position: Point2D | null) => void
  setLocalDragging: (positions: Record<string, Point2D> | null) => void
  setLocalResizing: (resizing: ResizingState | null) => void
  setLocalSelection: (nodeIds: Array<string> | null) => void
}

export interface CanvasAwarenessPresenceWriter {
  setPresence: (namespace: CanvasAwarenessNamespace, value: unknown) => void
}

export interface CanvasAwarenessWriter {
  core: CanvasCoreAwarenessWriter
  presence: CanvasAwarenessPresenceWriter
}

export interface CanvasAwarenessCapability {
  Layer?: ComponentType<{ remoteUsers: Array<RemoteUser> }>
}

export interface CanvasLocalOverlayCapability {
  Layer?: ComponentType
  clear: () => void
}

export interface CanvasToolServices {
  viewport: CanvasViewportTools
  document: CanvasDocumentWriter & CanvasDocumentReader & CanvasMeasuredNodeReader
  selection: CanvasSelectionController
  interaction: CanvasInteractionTools
  modifiers: CanvasModifierKeyReader
  editSession: CanvasEditSessionState
  toolState: CanvasToolStateControls
  awareness: CanvasAwarenessWriter
}

export interface CanvasToolController {
  onPointerDown?: (event: PointerEvent) => void
  onPointerMove?: (event: PointerEvent) => void
  onPointerUp?: (event: PointerEvent) => void
  onPointerCancel?: (event: PointerEvent) => void
  onKeyDown?: (event: KeyboardEvent) => void
  onKeyUp?: (event: KeyboardEvent) => void
  onNodeClick?: (event: ReactMouseEvent, node: Node) => void
  onEdgeClick?: (event: ReactMouseEvent, edge: Edge) => void
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
  localOverlay?: CanvasLocalOverlayCapability
  create: (services: CanvasToolServices) => CanvasToolController
}

export type AnyCanvasToolModule = {
  [TId in CanvasToolId]: CanvasToolModule<TId>
}[CanvasToolId]
