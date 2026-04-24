import {
  Background,
  ConnectionMode,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
} from '@xyflow/react'
import { ClientOnly } from '@tanstack/react-router'
import '@xyflow/react/dist/style.css'
import { useMemo } from 'react'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { ContextMenuHost } from '~/features/context-menu/components/context-menu-host'
import { cn } from '~/features/shadcn/lib/utils'
import { LoadingSpinner } from '~/shared/components/loading-spinner'
import { canvasEdgeTypes } from '../edges/canvas-edge-renderers'
import { CanvasConnectionPreview } from '../edges/shared/canvas-connection-preview'
import { canvasNodeTypes } from '../nodes/canvas-node-renderers'
import { CanvasRuntimeProvider } from '../runtime/providers/canvas-runtime-context'
import { CanvasViewportPersistence } from '../runtime/interaction/canvas-viewport-persistence'
import { useCanvasPendingSelectionPreviewSummary } from '../runtime/selection/use-canvas-pending-selection-preview'
import { loadPersistedCanvasViewport } from '../runtime/interaction/canvas-viewport-storage'
import { useCanvasViewerSession } from '../runtime/session/use-canvas-viewer-session'
import { useCanvasFlowRuntime } from '../runtime/use-canvas-flow-runtime'
import { CanvasAwarenessHost } from './canvas-awareness-host'
import { CanvasConditionalToolbar } from './canvas-conditional-toolbar'
import { CanvasLocalOverlaysHost } from './canvas-local-overlays-host'
import { MiniMapNode } from './canvas-minimap-node'
import { CanvasToolbar } from './canvas-toolbar'
import type { CanvasViewerSession } from '../runtime/session/use-canvas-viewer-session'
import type { Edge, Node } from '@xyflow/react'
import type { EditorViewerProps } from '~/features/editor/components/viewer/sidebar-item-editor'
import type { CanvasWithContent } from 'convex/canvases/types'

const PRO_OPTIONS = { hideAttribution: true }
const DELETE_KEYS_NONE: Array<string> = []
const EMPTY_NODES: Array<Node> = []
const EMPTY_EDGES: Array<Edge> = []
const PAN_MIDDLE_ONLY: Array<number> = [1]
const PAN_BOTH: Array<number> = [0, 1]
const SELECTION_KEY_DISABLED: Array<string> = []
const MAX_ZOOM = 4
const MIN_ZOOM = 0.1
export function CanvasViewer({ item: canvas }: EditorViewerProps<CanvasWithContent>) {
  return (
    <ClientOnly fallback={null}>
      <ReactFlowProvider>
        <CanvasViewerInner canvas={canvas} />
      </ReactFlowProvider>
    </ClientOnly>
  )
}

function CanvasViewerInner({ canvas }: { canvas: CanvasWithContent }) {
  const session = useCanvasViewerSession(canvas)

  if (session.status === 'error') {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center text-muted-foreground">
        <p>
          {typeof session.error === 'string'
            ? session.error
            : session.error?.message || 'Failed to load canvas. Please try refreshing the page.'}
        </p>
      </div>
    )
  }

  if (session.status === 'loading') {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return <CanvasFlow {...session} />
}

type ReadyCanvasSession = Extract<CanvasViewerSession, { status: 'ready' }>

export function CanvasFlow({
  canvasId,
  campaignId,
  canEdit,
  colorMode,
  parentId,
  provider,
  doc,
  nodesMap,
  edgesMap,
}: ReadyCanvasSession) {
  const initialViewport = useMemo(() => loadPersistedCanvasViewport(canvasId), [canvasId])
  const runtime = useCanvasFlowRuntime({
    nodesMap,
    edgesMap,
    canvasId,
    campaignId,
    canvasParentId: parentId,
    canEdit,
    provider,
    doc,
  })
  const pendingSelectionPreview = useCanvasPendingSelectionPreviewSummary()
  const edgeToolActive = runtime.activeTool === 'edge'

  return (
    <CanvasRuntimeProvider
      canEdit={canEdit}
      history={runtime.history}
      commands={runtime.commands}
      documentWriter={runtime.documentWriter}
      editSession={runtime.editSession}
      nodeActions={runtime.nodeActions}
      remoteHighlights={runtime.remoteHighlights}
      selection={runtime.selection}
    >
      <div
        className="canvas-flow-shell relative flex-1 min-h-0 allow-motion"
        style={{ cursor: runtime.toolCursor }}
        data-testid="canvas-flow-shell"
      >
        <CanvasToolbar canEdit={canEdit} />
        <CanvasConditionalToolbar canEdit={canEdit} />
        <div
          ref={runtime.canvasSurfaceRef}
          className="relative h-full w-full"
          data-testid="canvas-surface"
          role="region"
          aria-label="Canvas surface"
        >
          <ReactFlow
            defaultNodes={EMPTY_NODES}
            defaultEdges={EMPTY_EDGES}
            defaultViewport={initialViewport}
            onNodeDragStart={runtime.flowHandlers.onNodeDragStart}
            onNodeDrag={runtime.flowHandlers.onNodeDrag}
            onNodeDragStop={runtime.flowHandlers.onNodeDragStop}
            onNodesDelete={runtime.flowHandlers.onNodesDelete}
            onEdgesDelete={runtime.flowHandlers.onEdgesDelete}
            onConnect={runtime.flowHandlers.onConnect}
            onMoveStart={runtime.flowHandlers.onMoveStart}
            onMoveEnd={runtime.flowHandlers.onMoveEnd}
            onNodeClick={runtime.flowHandlers.onNodeClick}
            onEdgeClick={runtime.flowHandlers.onEdgeClick}
            onPaneClick={runtime.flowHandlers.onPaneClick}
            onNodeContextMenu={runtime.contextMenu.openForNode}
            onEdgeContextMenu={runtime.contextMenu.openForEdge}
            onPaneContextMenu={runtime.contextMenu.openForPane}
            onMouseMove={runtime.flowHandlers.onMouseMove}
            onMouseLeave={runtime.flowHandlers.onMouseLeave}
            edgeTypes={canvasEdgeTypes}
            nodeTypes={canvasNodeTypes}
            connectionLineComponent={CanvasConnectionPreview}
            nodesDraggable={false}
            nodesConnectable={canEdit && edgeToolActive}
            connectOnClick={false}
            elevateNodesOnSelect={false}
            elevateEdgesOnSelect={false}
            elementsSelectable={false}
            selectionOnDrag={false}
            selectionMode={SelectionMode.Partial}
            connectionMode={ConnectionMode.Loose}
            selectionKeyCode={SELECTION_KEY_DISABLED}
            panOnDrag={runtime.activeTool === 'hand' ? PAN_BOTH : PAN_MIDDLE_ONLY}
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
              key={canvasId}
              canvasId={canvasId}
              initialViewport={initialViewport}
            />
            <Background bgColor="var(--background)" />
            <MiniMap zoomable={false} pannable={false} nodeComponent={MiniMapNode} />
            <CanvasLocalOverlaysHost />
            <CanvasAwarenessHost remoteUsers={runtime.remoteUsers} />
          </ReactFlow>

          <ContextMenuHost
            ref={runtime.contextMenu.hostRef}
            menu={runtime.contextMenu.menu}
            onClose={runtime.contextMenu.onClose}
          />

          {pendingSelectionPreview.active &&
            pendingSelectionPreview.nodeCount + pendingSelectionPreview.edgeCount > 0 && (
              <CanvasPendingSelectionStatus
                nodeCount={pendingSelectionPreview.nodeCount}
                edgeCount={pendingSelectionPreview.edgeCount}
              />
            )}

          <CanvasDropOverlay
            ref={runtime.dropTarget.dropOverlayRef}
            isDropTarget={runtime.dropTarget.isDropTarget}
            isFileDropTarget={runtime.dropTarget.isFileDropTarget}
          />
        </div>
      </div>
    </CanvasRuntimeProvider>
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
      {`Selecting ${parts.join(', ')}`}
    </div>
  )
}

const CanvasDropOverlay = ({
  ref,
  isDropTarget,
  isFileDropTarget,
}: {
  ref: React.Ref<HTMLDivElement>
  isDropTarget: boolean
  isFileDropTarget: boolean
}) => {
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
CanvasDropOverlay.displayName = 'CanvasDropOverlay'
