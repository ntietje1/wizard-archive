import type {
  CanvasAwarenessNamespace,
  Point2D,
  ResizingState,
  RemoteUser,
} from '../utils/canvas-awareness-types'
import type { CanvasEdgePatch, CanvasEdgeType } from '../edges/canvas-edge-types'
import type { CanvasInspectableProperties } from '../properties/canvas-property-types'
import type {
  CanvasSelectionCommitMode,
  CanvasSelectionGestureKind,
  CanvasSelectionSnapshot,
} from '../system/canvas-selection'
import type {
  CanvasConnection,
  CanvasEdge,
  CanvasNode,
  CanvasPosition,
} from '../types/canvas-domain-types'
import type { ComponentType, CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react'

export type CanvasToolId = 'select' | 'hand' | 'draw' | 'erase' | 'lasso' | 'text' | 'edge'
export type {
  CanvasSelectionCommitMode,
  CanvasSelectionGestureKind,
  CanvasSelectionSnapshot,
} from '../system/canvas-selection'

interface CanvasToolSettings {
  strokeColor: string
  strokeOpacity: number
  strokeSize: number
  edgeType: CanvasEdgeType
}

export interface CanvasEdgeCreationDefaults {
  type: CanvasEdgeType
  style?: CSSProperties
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
  pendingEditNodePoint: Point2D | null
  setPendingEditNodeId: (id: string | null) => void
  setPendingEditNodePoint: (point: Point2D | null) => void
}

/**
 * Per-node UI callbacks for node components. Prefer this interface inside node renderers for
 * immediate interaction updates; `onResize` and `onResizeEnd` separate live resize feedback from
 * the committed resize write.
 */
export interface CanvasNodeActions {
  transact?: (fn: () => void) => void
  onResize: (nodeId: string, width: number, height: number, position: CanvasPosition) => void
  onResizeEnd: (nodeId: string, width: number, height: number, position: CanvasPosition) => void
  onResizeMany: (updates: ReadonlyMap<string, CanvasNodeResizeUpdate>) => void
  onResizeManyCancel: (updates: ReadonlyMap<string, CanvasNodeResizeUpdate>) => void
  onResizeManyEnd: (updates: ReadonlyMap<string, CanvasNodeResizeUpdate>) => void
}

export interface CanvasNodeResizeUpdate {
  width: number
  height: number
  position: CanvasPosition
}

export interface CanvasDocumentWriter {
  createNode: (node: CanvasNode) => void
  patchNodeData: (updates: ReadonlyMap<string, Record<string, unknown>>) => void
  patchEdges: (updates: ReadonlyMap<string, CanvasEdgePatch>) => void
  resizeNode: (nodeId: string, width: number, height: number, position: CanvasPosition) => void
  resizeNodes: (updates: ReadonlyMap<string, CanvasNodeResizeUpdate>) => void
  deleteNodes: (nodeIds: ReadonlySet<string>) => void
  createEdge: (connection: CanvasConnection, defaults?: CanvasEdgeCreationDefaults) => void
  deleteEdges: (edgeIds: ReadonlySet<string>) => void
  setNodePositions: (positions: ReadonlyMap<string, CanvasPosition>) => void
}

interface CanvasDocumentReader {
  getNodes: () => Array<CanvasNode>
  getEdges: () => Array<CanvasEdge>
}

export type CanvasMeasuredNode = CanvasNode & {
  width: number
  height: number
}

interface CanvasMeasuredNodeReader {
  getMeasuredNodes: () => Array<CanvasMeasuredNode>
}

interface CanvasDocumentQuery {
  getNodes: CanvasDocumentReader['getNodes']
  getEdges: CanvasDocumentReader['getEdges']
  getMeasuredNodes: CanvasMeasuredNodeReader['getMeasuredNodes']
}

export interface CanvasSelectionController {
  getSnapshot: () => CanvasSelectionSnapshot
  setSelection: (selection: CanvasSelectionSnapshot) => void
  clearSelection: () => void
  toggleNode: (nodeId: string, additive: boolean) => void
  toggleEdge: (edgeId: string, additive: boolean) => void
  beginGesture: (kind: CanvasSelectionGestureKind, mode: CanvasSelectionCommitMode) => void
  setGesturePreview: (selection: CanvasSelectionSnapshot | null) => void
  commitGesture: () => void
  cancelGesture: () => void
}

export interface CanvasInteractionTools {
  suppressNextSurfaceClick: () => void
}

interface CanvasModifierKeyReader {
  getShiftPressed: () => boolean
  getPrimaryPressed: () => boolean
}

export interface CanvasViewportTools {
  screenToCanvasPosition: (position: Point2D) => CanvasPosition
  getZoom: () => number
}

interface CanvasToolStateControls {
  getSettings: () => CanvasToolSettings
  getActiveTool: () => CanvasToolId
  setActiveTool: (tool: CanvasToolId) => void
  setEdgeType: (type: CanvasEdgeType) => void
  setStrokeColor: (color: string) => void
  setStrokeSize: (size: number) => void
  setStrokeOpacity: (opacity: number) => void
}

export interface CanvasToolPropertyContext {
  toolState: Pick<
    CanvasToolStateControls,
    'getSettings' | 'setEdgeType' | 'setStrokeColor' | 'setStrokeSize' | 'setStrokeOpacity'
  >
}

export interface CanvasCoreAwarenessWriter {
  setLocalCursor: (position: Point2D | null) => void
  setLocalResizing: (resizing: ResizingState | null) => void
  setLocalSelection: (nodeIds: ReadonlySet<string> | null) => void
}

export interface CanvasAwarenessPresenceWriter {
  setPresence: (namespace: CanvasAwarenessNamespace, value: unknown) => void
}

interface CanvasAwarenessWriter {
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

export interface CanvasToolRuntime {
  viewport: CanvasViewportTools
  commands: CanvasDocumentWriter
  query: CanvasDocumentQuery
  selection: CanvasSelectionController
  interaction: CanvasInteractionTools
  modifiers: CanvasModifierKeyReader
  editSession: CanvasEditSessionState
  toolState: CanvasToolStateControls
  awareness: CanvasAwarenessWriter
}

export interface CanvasToolHandlers {
  onPointerDown?: (event: PointerEvent) => void
  onPointerMove?: (event: PointerEvent) => void
  onPointerUp?: (event: PointerEvent) => void
  onPointerCancel?: (event: PointerEvent) => void
  onKeyDown?: (event: KeyboardEvent) => void
  onKeyUp?: (event: KeyboardEvent) => void
  onNodeClick?: (event: ReactMouseEvent, node: CanvasNode) => void
  onEdgeClick?: (event: ReactMouseEvent, edge: CanvasEdge) => void
  onMoveStart?: (event: MouseEvent | TouchEvent | null) => void
  onMoveEnd?: () => void
}

export interface CanvasToolSpec<TId extends CanvasToolId = CanvasToolId> {
  id: TId
  label: string
  group: 'selection' | 'creation'
  icon: ReactNode
  cursor?: string
  properties?: (context: CanvasToolPropertyContext) => CanvasInspectableProperties
  awareness?: CanvasAwarenessCapability & {
    clear?: (presence: CanvasAwarenessPresenceWriter) => void
  }
  localOverlay?: CanvasLocalOverlayCapability
  createHandlers: (runtime: CanvasToolRuntime) => CanvasToolHandlers
}

export type AnyCanvasToolSpec = {
  [TId in CanvasToolId]: CanvasToolSpec<TId>
}[CanvasToolId]
