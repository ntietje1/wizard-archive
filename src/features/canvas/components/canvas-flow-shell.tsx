import { Background, ConnectionMode, MiniMap, ReactFlow, SelectionMode } from '@xyflow/react'
import { useShallow } from 'zustand/shallow'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { cn } from '~/features/shadcn/lib/utils'
import { CanvasAwarenessHost } from './canvas-awareness-host'
import { CanvasConditionalToolbar } from './canvas-conditional-toolbar'
import { CanvasLocalOverlaysHost } from './canvas-local-overlays-host'
import { MiniMapNode } from './canvas-minimap-node'
import { CanvasToolbar } from './canvas-toolbar'
import { canvasEdgeTypes } from '../edges/canvas-edge-registry'
import { canvasNodeTypes } from '../nodes/canvas-node-types'
import { useCanvasPendingSelectionPreviewStore } from '../runtime/selection/use-canvas-pending-selection-preview'
import type { RemoteUser } from '../utils/canvas-awareness-types'
import type { Edge, Node, OnConnect, OnEdgesDelete, OnNodeDrag, OnNodesDelete } from '@xyflow/react'

const PRO_OPTIONS = { hideAttribution: true }
const DELETE_KEYS = ['Backspace', 'Delete']
const DELETE_KEYS_NONE: Array<string> = []
const EMPTY_NODES: Array<Node> = []
const EMPTY_EDGES: Array<Edge> = []
const PAN_MIDDLE_ONLY: Array<number> = [1]
const PAN_BOTH: Array<number> = [0, 1]
const SELECTION_KEY_DISABLED: Array<string> = []
const MAX_ZOOM = 4
const MIN_ZOOM = 0.1

export interface CanvasFlowShellProps {
  toolCursor: string | undefined
  canvasSurfaceRef: React.RefObject<HTMLDivElement | null>
  remoteUsers: Array<RemoteUser>
  activeTool: string
  onNodeDragStart?: OnNodeDrag
  onNodeDrag?: OnNodeDrag
  onNodeDragStop?: OnNodeDrag
  onNodesDelete?: OnNodesDelete
  onEdgesDelete?: OnEdgesDelete
  onConnect?: OnConnect
  onMoveStart?: (event: MouseEvent | TouchEvent | null) => void
  onMoveEnd?: () => void
  onNodeClick?: (event: React.MouseEvent, node: Node) => void
  onEdgeClick?: (event: React.MouseEvent, edge: Edge) => void
  onPaneClick?: (event: React.MouseEvent) => void
  onMouseMove: (event: React.MouseEvent) => void
  onMouseLeave: () => void
  dropOverlayRef: React.Ref<HTMLDivElement>
  isDropTarget: boolean
  isFileDropTarget: boolean
}

interface CanvasFlowShellComponentProps extends CanvasFlowShellProps {
  canEdit: boolean
  colorMode: 'light' | 'dark'
}

export function CanvasFlowShell({
  canEdit,
  colorMode,
  toolCursor,
  canvasSurfaceRef,
  remoteUsers,
  activeTool,
  onNodeDragStart,
  onNodeDrag,
  onNodeDragStop,
  onNodesDelete,
  onEdgesDelete,
  onConnect,
  onMoveStart,
  onMoveEnd,
  onNodeClick,
  onEdgeClick,
  onPaneClick,
  onMouseMove,
  onMouseLeave,
  dropOverlayRef,
  isDropTarget,
  isFileDropTarget,
}: CanvasFlowShellComponentProps) {
  const isSelectMode = activeTool === 'select'
  const pendingSelectionPreview = useCanvasPendingSelectionPreviewStore(
    useShallow((state) => ({
      active: state.pendingNodeIds !== null,
      nodeCount: state.pendingNodeIds?.size ?? 0,
      edgeCount: state.pendingEdgeIds?.size ?? 0,
    })),
  )

  return (
    <div
      className="canvas-flow-shell relative flex-1 min-h-0 allow-motion"
      style={{ cursor: toolCursor }}
      data-testid="canvas-flow-shell"
    >
      <CanvasToolbar canEdit={canEdit} />
      <CanvasConditionalToolbar canEdit={canEdit} />
      <div
        ref={canvasSurfaceRef}
        className="relative h-full w-full"
        data-testid="canvas-surface"
        role="region"
        aria-label="Canvas surface"
      >
        <ReactFlow
          defaultNodes={EMPTY_NODES}
          defaultEdges={EMPTY_EDGES}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onConnect={onConnect}
          onMoveStart={onMoveStart}
          onMoveEnd={onMoveEnd}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          edgeTypes={canvasEdgeTypes}
          nodeTypes={canvasNodeTypes}
          nodesDraggable={false}
          nodesConnectable={canEdit && isSelectMode}
          // Canvas selection is owned by runtime selection state for both nodes and edges.
          elementsSelectable={false}
          // Marquee selection is handled in canvas runtime so node-owned hit testing can override
          // React Flow's default bounds-based drag selection.
          selectionOnDrag={false}
          selectionMode={SelectionMode.Partial}
          connectionMode={ConnectionMode.Loose}
          selectionKeyCode={SELECTION_KEY_DISABLED}
          panOnDrag={activeTool === 'hand' ? PAN_BOTH : PAN_MIDDLE_ONLY}
          deleteKeyCode={canEdit && isSelectMode ? DELETE_KEYS : DELETE_KEYS_NONE}
          colorMode={colorMode}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          panOnScroll={false}
          preventScrolling={false}
          proOptions={PRO_OPTIONS}
        >
          <Background bgColor="var(--background)" />
          <MiniMap zoomable={false} pannable={false} nodeComponent={MiniMapNode} />
          <CanvasLocalOverlaysHost />
          <CanvasAwarenessHost remoteUsers={remoteUsers} />
        </ReactFlow>

        {pendingSelectionPreview.active && (
          <CanvasPendingSelectionStatus
            nodeCount={pendingSelectionPreview.nodeCount}
            edgeCount={pendingSelectionPreview.edgeCount}
          />
        )}

        <CanvasDropOverlay
          ref={dropOverlayRef}
          isDropTarget={isDropTarget}
          isFileDropTarget={isFileDropTarget}
        />
      </div>
    </div>
  )
}

function CanvasPendingSelectionStatus({
  nodeCount,
  edgeCount,
}: {
  nodeCount: number
  edgeCount: number
}) {
  const parts = [
    nodeCount > 0 ? `${nodeCount} node${nodeCount === 1 ? '' : 's'}` : null,
    edgeCount > 0 ? `${edgeCount} edge${edgeCount === 1 ? '' : 's'}` : null,
  ].filter(Boolean)

  return (
    <div
      className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-full border bg-background/90 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      {`Selecting ${parts.length > 0 ? parts.join(', ') : '0 items'}`}
    </div>
  )
}

function CanvasDropOverlay({
  ref,
  isDropTarget,
  isFileDropTarget,
}: {
  ref: React.Ref<HTMLDivElement>
  isDropTarget: boolean
  isFileDropTarget: boolean
}) {
  const isDragging = useDndStore((state) => state.isDraggingElement || state.isDraggingFiles)
  const active = isDropTarget || isFileDropTarget

  return (
    <div
      ref={ref}
      className={cn(
        'absolute inset-0 z-[4]',
        isDragging ? 'pointer-events-auto' : 'pointer-events-none',
        active && 'bg-ring/5 ring-2 ring-inset ring-ring/60',
      )}
    />
  )
}
