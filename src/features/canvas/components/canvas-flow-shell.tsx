import { useRef } from 'react'
import { Background, ConnectionMode, MiniMap, ReactFlow, SelectionMode } from '@xyflow/react'
import type { Id } from 'convex/_generated/dataModel'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { cn } from '~/features/shadcn/lib/utils'
import { CanvasAwarenessHost } from './canvas-awareness-host'
import { CanvasConditionalToolbar } from './canvas-conditional-toolbar'
import { CanvasLocalOverlaysHost } from './canvas-local-overlays-host'
import { MiniMapNode } from './canvas-minimap-node'
import { CanvasToolbar } from './canvas-toolbar'
import { canvasEdgeTypes } from '../edges/canvas-edge-registry'
import { getCanvasNodeTypes } from '../nodes/canvas-node-modules'
import { CanvasContextMenu } from '../runtime/context-menu/canvas-context-menu'
import type { CanvasContextMenuRef } from '../runtime/context-menu/canvas-context-menu'
import { CanvasViewportPersistence } from '../runtime/interaction/canvas-viewport-persistence'
import type { PersistedCanvasViewport } from '../runtime/interaction/canvas-viewport-storage'
import { useCanvasPendingSelectionPreviewSummary } from '../runtime/selection/use-canvas-pending-selection-preview'
import type { RemoteUser } from '../utils/canvas-awareness-types'
import type { CanvasSelectionController, CanvasToolId } from '../tools/canvas-tool-types'
import type { Edge, Node, OnConnect, OnEdgesDelete, OnNodeDrag, OnNodesDelete } from '@xyflow/react'
import type * as Y from 'yjs'

const PRO_OPTIONS = { hideAttribution: true }
const DELETE_KEYS_NONE: Array<string> = []
const EMPTY_NODES: Array<Node> = []
const EMPTY_EDGES: Array<Edge> = []
const PAN_MIDDLE_ONLY: Array<number> = [1]
const PAN_BOTH: Array<number> = [0, 1]
const SELECTION_KEY_DISABLED: Array<string> = []
const MAX_ZOOM = 4
const MIN_ZOOM = 0.1
const canvasNodeTypes = getCanvasNodeTypes()

export interface CanvasFlowShellProps {
  chrome: {
    toolCursor: string | undefined
    remoteUsers: Array<RemoteUser>
    activeTool: CanvasToolId
    dropTarget: {
      overlayRef: React.Ref<HTMLDivElement>
      isTarget: boolean
      isFileTarget: boolean
    }
  }
  canvasSurfaceRef: React.RefObject<HTMLDivElement | null>
  contextMenu: {
    campaignId: Id<'campaigns'>
    canvasParentId: Id<'sidebarItems'> | null
    nodesMap: Y.Map<Node>
    edgesMap: Y.Map<Edge>
    createNode: (node: Node) => void
    screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number }
    selectionController: Pick<CanvasSelectionController, 'replace' | 'clear'>
  }
  viewportPersistence: {
    canvasId: Id<'sidebarItems'>
    initialViewport: PersistedCanvasViewport
  }
  flowHandlers: {
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
  }
}

interface CanvasFlowShellComponentProps extends CanvasFlowShellProps {
  canEdit: boolean
  colorMode: 'light' | 'dark'
}

export function CanvasFlowShell({
  canEdit,
  colorMode,
  chrome,
  canvasSurfaceRef,
  contextMenu,
  viewportPersistence,
  flowHandlers,
}: CanvasFlowShellComponentProps) {
  const isSelectMode = chrome.activeTool === 'select'
  const contextMenuRef = useRef<CanvasContextMenuRef>(null)
  const pendingSelectionPreview = useCanvasPendingSelectionPreviewSummary()

  return (
    <div
      className="canvas-flow-shell relative flex-1 min-h-0 allow-motion"
      style={{ cursor: chrome.toolCursor }}
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
          defaultViewport={viewportPersistence.initialViewport}
          onNodeDragStart={flowHandlers.onNodeDragStart}
          onNodeDrag={flowHandlers.onNodeDrag}
          onNodeDragStop={flowHandlers.onNodeDragStop}
          onNodesDelete={flowHandlers.onNodesDelete}
          onEdgesDelete={flowHandlers.onEdgesDelete}
          onConnect={flowHandlers.onConnect}
          onMoveStart={flowHandlers.onMoveStart}
          onMoveEnd={flowHandlers.onMoveEnd}
          onNodeClick={flowHandlers.onNodeClick}
          onEdgeClick={flowHandlers.onEdgeClick}
          onPaneClick={flowHandlers.onPaneClick}
          onNodeContextMenu={(event, node) =>
            contextMenuRef.current?.onNodeContextMenu(event, node)
          }
          onEdgeContextMenu={(event, edge) =>
            contextMenuRef.current?.onEdgeContextMenu(event, edge)
          }
          onPaneContextMenu={(event) => contextMenuRef.current?.onPaneContextMenu(event)}
          onMouseMove={flowHandlers.onMouseMove}
          onMouseLeave={flowHandlers.onMouseLeave}
          edgeTypes={canvasEdgeTypes}
          nodeTypes={canvasNodeTypes}
          nodesDraggable={false}
          nodesConnectable={canEdit && isSelectMode}
          elevateNodesOnSelect={false}
          elevateEdgesOnSelect={false}
          // Canvas selection is owned by runtime selection state for both nodes and edges.
          elementsSelectable={false}
          // Marquee selection is handled in canvas runtime so node-owned hit testing can override
          // React Flow's default bounds-based drag selection.
          selectionOnDrag={false}
          selectionMode={SelectionMode.Partial}
          connectionMode={ConnectionMode.Loose}
          selectionKeyCode={SELECTION_KEY_DISABLED}
          panOnDrag={chrome.activeTool === 'hand' ? PAN_BOTH : PAN_MIDDLE_ONLY}
          deleteKeyCode={DELETE_KEYS_NONE}
          colorMode={colorMode}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          panOnScroll={false}
          preventScrolling={false}
          proOptions={PRO_OPTIONS}
        >
          <CanvasViewportPersistence
            key={viewportPersistence.canvasId}
            canvasId={viewportPersistence.canvasId}
            initialViewport={viewportPersistence.initialViewport}
          />
          <Background bgColor="var(--background)" />
          <MiniMap zoomable={false} pannable={false} nodeComponent={MiniMapNode} />
          <CanvasLocalOverlaysHost />
          <CanvasAwarenessHost remoteUsers={chrome.remoteUsers} />
        </ReactFlow>

        <CanvasContextMenu
          ref={contextMenuRef}
          activeTool={chrome.activeTool}
          canEdit={canEdit}
          campaignId={contextMenu.campaignId}
          canvasParentId={contextMenu.canvasParentId}
          nodesMap={contextMenu.nodesMap}
          edgesMap={contextMenu.edgesMap}
          createNode={contextMenu.createNode}
          screenToFlowPosition={contextMenu.screenToFlowPosition}
          selectionController={contextMenu.selectionController}
        />

        {pendingSelectionPreview.active &&
          pendingSelectionPreview.nodeCount + pendingSelectionPreview.edgeCount > 0 && (
            <CanvasPendingSelectionStatus
              nodeCount={pendingSelectionPreview.nodeCount}
              edgeCount={pendingSelectionPreview.edgeCount}
            />
          )}

        <CanvasDropOverlay
          ref={chrome.dropTarget.overlayRef}
          isDropTarget={chrome.dropTarget.isTarget}
          isFileDropTarget={chrome.dropTarget.isFileTarget}
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
  if (nodeCount === 0 && edgeCount === 0) {
    return null
  }

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
