import {
  Background,
  MiniMap,
  ReactFlow,
  SelectionMode,
  ViewportPortal,
} from '@xyflow/react'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { cn } from '~/features/shadcn/lib/utils'
import { CanvasConditionalToolbar } from './canvas-conditional-toolbar'
import { MiniMapNode } from './canvas-minimap-node'
import { CanvasRemoteCursors } from './canvas-remote-cursors'
import { CanvasStrokes } from './canvas-strokes'
import { CanvasToolbar } from './canvas-toolbar'
import { canvasNodeTypes } from './nodes/canvas-node-registry'
import type { Point2D, RemoteUser } from '../utils/canvas-awareness-types'
import type { Bounds } from '../utils/canvas-stroke-utils'
import type {
  Edge,
  Node,
  OnConnect,
  OnEdgesDelete,
  OnNodeDrag,
  OnNodesDelete,
} from '@xyflow/react'

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

interface CanvasFlowShellProps {
  canEdit: boolean
  colorMode: 'light' | 'dark'
  toolCursor: string | undefined
  wrapperRef: (node: HTMLDivElement | null) => void
  remoteUsers: Array<RemoteUser>
  lassoPath: Array<Point2D>
  selectionRect: Bounds | null
  activeTool: string
  onNodeDragStart?: OnNodeDrag
  onNodeDrag?: OnNodeDrag
  onNodeDragStop?: OnNodeDrag
  onNodesDelete?: OnNodesDelete
  onEdgesDelete?: OnEdgesDelete
  onConnect?: OnConnect
  onMoveStart: (event: MouseEvent | TouchEvent | null) => void
  onMoveEnd: () => void
  onPaneClick?: (event: React.MouseEvent) => void
  onMouseMove: (event: React.MouseEvent) => void
  onMouseLeave: () => void
  dropOverlayRef: React.Ref<HTMLDivElement>
  isDropTarget: boolean
  isFileDropTarget: boolean
}

export function CanvasFlowShell({
  canEdit,
  colorMode,
  toolCursor,
  wrapperRef,
  remoteUsers,
  lassoPath,
  selectionRect,
  activeTool,
  onNodeDragStart,
  onNodeDrag,
  onNodeDragStop,
  onNodesDelete,
  onEdgesDelete,
  onConnect,
  onMoveStart,
  onMoveEnd,
  onPaneClick,
  onMouseMove,
  onMouseLeave,
  dropOverlayRef,
  isDropTarget,
  isFileDropTarget,
}: CanvasFlowShellProps) {
  const isSelectMode = activeTool === 'select'

  return (
    <div ref={wrapperRef} className="relative flex-1 min-h-0 allow-motion" style={{ cursor: toolCursor }}>
      <CanvasToolbar canEdit={canEdit} />
      <CanvasConditionalToolbar canEdit={canEdit} />
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
        onPaneClick={onPaneClick}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        nodeTypes={canvasNodeTypes}
        nodesDraggable={false}
        nodesConnectable={canEdit && isSelectMode}
        elementsSelectable={canEdit && isSelectMode}
        selectionOnDrag={canEdit && isSelectMode}
        selectionMode={SelectionMode.Partial}
        selectionKeyCode={SELECTION_KEY_DISABLED}
        panOnDrag={activeTool === 'hand' ? PAN_BOTH : PAN_MIDDLE_ONLY}
        deleteKeyCode={canEdit && isSelectMode ? DELETE_KEYS : DELETE_KEYS_NONE}
        colorMode={colorMode}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        zoomOnScroll={false}
        panOnScroll={false}
        preventScrolling={false}
        proOptions={PRO_OPTIONS}
      >
        <Background bgColor="var(--background)" />
        <MiniMap zoomable={false} pannable={false} nodeComponent={MiniMapNode} />
        <ViewportPortal>
          <CanvasStrokes remoteUsers={remoteUsers} />
          <CanvasRemoteCursors remoteUsers={remoteUsers} />
          <CanvasSelectionOverlays
            lassoPath={lassoPath}
            selectionRect={selectionRect}
            remoteUsers={remoteUsers}
          />
        </ViewportPortal>
      </ReactFlow>

      <CanvasDropOverlay
        ref={dropOverlayRef}
        isDropTarget={isDropTarget}
        isFileDropTarget={isFileDropTarget}
      />
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

const SELECTION_STYLE = {
  fill: 'var(--primary)',
  fillOpacity: 0.08,
  stroke: 'var(--primary)',
  strokeWidth: 1,
  strokeDasharray: '3 3',
} as const

function CanvasSelectionOverlays({
  lassoPath,
  selectionRect,
  remoteUsers,
}: {
  lassoPath: Array<Point2D>
  selectionRect: Bounds | null
  remoteUsers: Array<RemoteUser>
}) {
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      {lassoPath.length >= 2 && (
        <polyline
          points={lassoPath.map((point) => `${point.x},${point.y}`).join(' ')}
          {...SELECTION_STYLE}
        />
      )}

      {selectionRect && (
        <rect
          x={selectionRect.x}
          y={selectionRect.y}
          width={selectionRect.width}
          height={selectionRect.height}
          {...SELECTION_STYLE}
        />
      )}

      {remoteUsers.map((remoteUser) => {
        if (!remoteUser.selecting) return null
        const selecting = remoteUser.selecting

        if (selecting.type === 'rect') {
          return (
            <rect
              key={`selection-${remoteUser.clientId}`}
              x={selecting.x}
              y={selecting.y}
              width={selecting.width}
              height={selecting.height}
              fill={remoteUser.user.color}
              fillOpacity={0.06}
              stroke={remoteUser.user.color}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )
        }

        if (selecting.type === 'lasso' && selecting.points.length >= 2) {
          return (
            <polyline
              key={`selection-${remoteUser.clientId}`}
              points={selecting.points.map((point) => `${point.x},${point.y}`).join(' ')}
              fill={remoteUser.user.color}
              fillOpacity={0.06}
              stroke={remoteUser.user.color}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )
        }

        return null
      })}
    </svg>
  )
}
