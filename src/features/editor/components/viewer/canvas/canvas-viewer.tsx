import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Background,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  ViewportPortal,
  useOnSelectionChange,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { api } from 'convex/_generated/api'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { hasAtLeastPermissionLevel } from 'convex/permissions/hasAtLeastPermissionLevel'
import { CanvasContext } from './canvas-context'
import { canvasNodeTypes } from './canvas-node-types'
import { CanvasToolbar } from './canvas-toolbar'
import { CanvasRemoteCursors } from './canvas-remote-cursors'
import { CanvasStrokes } from './canvas-strokes'
import type { RemoteHighlight } from './canvas-context'
import type { Bounds } from './canvas-stroke-utils'
import type { RemoteUser } from './canvas-awareness-types'
import type { Edge, Node, OnNodeDrag } from '@xyflow/react'
import type * as Y from 'yjs'
import type { EditorViewerProps } from '../sidebar-item-editor'
import type { CanvasWithContent } from 'convex/canvases/types'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'
import { useCanvasToolStore } from '~/features/editor/stores/canvas-tool-store'
import { LoadingSpinner } from '~/shared/components/loading-spinner'
import { useCanvasYjsCollaboration } from '~/features/editor/hooks/useCanvasYjsCollaboration'
import { useYjsReactFlowSync } from '~/features/editor/hooks/useYjsReactFlowSync'
import { useCanvasAwareness } from '~/features/editor/hooks/useCanvasAwareness'
import { useCanvasDrawing } from '~/features/editor/hooks/useCanvasDrawing'
import { useCanvasEraser } from '~/features/editor/hooks/useCanvasEraser'
import { useCanvasLassoSelection } from '~/features/editor/hooks/useCanvasLassoSelection'
import { useCanvasRectangleDraw } from '~/features/editor/hooks/useCanvasRectangleDraw'
import { useCanvasSelectionRect } from '~/features/editor/hooks/useCanvasSelectionRect'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { useResolvedTheme } from '~/features/settings/hooks/useTheme'

const CURSOR_COLORS = [
  '#e06c75',
  '#e5c07b',
  '#98c379',
  '#56b6c2',
  '#61afef',
  '#c678dd',
  '#d19a66',
  '#be5046',
]

function getCursorColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}

const PRO_OPTIONS = { hideAttribution: true }
const DELETE_KEYS = ['Backspace', 'Delete']
const DELETE_KEYS_NONE: Array<string> = []
const EMPTY_NODES: Array<Node> = []
const EMPTY_EDGES: Array<Edge> = []
const EMPTY_DRAG_POSITIONS: Record<string, { x: number; y: number }> = {}
const PAN_MIDDLE_ONLY: Array<number> = [1]
const PAN_BOTH: Array<number> = [0, 1]
const SELECTION_KEY_DISABLED: Array<string> = []

export function CanvasViewer({
  item: canvas,
}: EditorViewerProps<CanvasWithContent>) {
  return (
    <ReactFlowProvider>
      <CanvasViewerInner canvas={canvas} />
    </ReactFlowProvider>
  )
}

function CanvasViewerInner({ canvas }: { canvas: CanvasWithContent }) {
  const profileQuery = useAuthQuery(api.users.queries.getUserProfile, {})
  const profile = profileQuery.data
  const resolvedTheme = useResolvedTheme()

  const canEdit = hasAtLeastPermissionLevel(
    canvas.myPermissionLevel,
    PERMISSION_LEVEL.EDIT,
  )

  const userName = profile?.name ?? profile?.username ?? 'Anonymous'
  const userColor = profile ? getCursorColor(profile._id) : '#61afef'

  const { doc, provider, isLoading } = useCanvasYjsCollaboration(
    canvas._id,
    { name: userName, color: userColor },
    canEdit,
  )

  const nodesMap = useMemo(
    () => (doc ? doc.getMap<Node>('nodes') : null),
    [doc],
  )
  const edgesMap = useMemo(
    () => (doc ? doc.getMap<Edge>('edges') : null),
    [doc],
  )

  useEffect(() => {
    return () => useCanvasToolStore.getState().reset()
  }, [canvas._id])

  if (isLoading || !doc || !nodesMap || !edgesMap) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <CanvasFlow
      nodesMap={nodesMap}
      edgesMap={edgesMap}
      canEdit={canEdit}
      colorMode={resolvedTheme}
      provider={provider}
    />
  )
}

function CanvasFlow({
  nodesMap,
  edgesMap,
  canEdit,
  colorMode,
  provider,
}: {
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  canEdit: boolean
  colorMode: 'light' | 'dark'
  provider: ConvexYjsProvider | null
}) {
  const reactFlowInstance = useReactFlow()
  const {
    remoteUsers,
    setLocalCursor,
    setLocalDragging,
    setLocalSelection,
    setLocalDrawing,
    setLocalSelecting,
  } = useCanvasAwareness(provider)

  const activeTool = useCanvasToolStore((s) => s.activeTool)
  const lassoPath = useCanvasToolStore((s) => s.lassoPath)
  const selectionRect = useCanvasToolStore((s) => s.selectionRect)

  const isSelectMode = activeTool === 'select'
  const isHandMode = activeTool === 'hand'

  const remoteDragPositions = useMemo(() => {
    let merged: Record<string, { x: number; y: number }> | null = null
    for (const user of remoteUsers) {
      if (!user.dragging) continue
      if (!merged) merged = {}
      Object.assign(merged, user.dragging)
    }
    return merged ?? EMPTY_DRAG_POSITIONS
  }, [remoteUsers])

  const {
    onNodeDragStart,
    onNodeDragStop,
    onNodesDelete,
    onEdgesDelete,
    onConnect,
  } = useYjsReactFlowSync(nodesMap, edgesMap, remoteDragPositions)

  const drawing = useCanvasDrawing({
    nodesMap,
    setAwarenessDrawing: setLocalDrawing,
  })
  const eraser = useCanvasEraser({ nodesMap })
  const lasso = useCanvasLassoSelection({
    setLocalSelecting,
  })
  const rectangleDraw = useCanvasRectangleDraw({ nodesMap })
  useCanvasSelectionRect({
    setLocalSelecting,
    enabled: canEdit && isSelectMode,
  })

  const overlayHandlers = useMemo(() => {
    if (activeTool === 'draw')
      return {
        onPointerDown: drawing.onPointerDown,
        onPointerMove: drawing.onPointerMove,
        onPointerUp: drawing.onPointerUp,
      }
    if (activeTool === 'erase')
      return {
        onPointerDown: eraser.onPointerDown,
        onPointerMove: eraser.onPointerMove,
        onPointerUp: eraser.onPointerUp,
      }
    if (activeTool === 'lasso')
      return {
        onPointerDown: lasso.onPointerDown,
        onPointerMove: lasso.onPointerMove,
        onPointerUp: lasso.onPointerUp,
      }
    if (activeTool === 'rectangle')
      return {
        onPointerDown: rectangleDraw.onPointerDown,
        onPointerMove: rectangleDraw.onPointerMove,
        onPointerUp: rectangleDraw.onPointerUp,
      }
    return null
  }, [activeTool, drawing, eraser, lasso, rectangleDraw])

  const handleNodeDrag: OnNodeDrag = useCallback(
    (event, _node, nodes) => {
      setLocalDragging(Object.fromEntries(nodes.map((n) => [n.id, n.position])))
      const pos = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      setLocalCursor(pos)
    },
    [setLocalDragging, reactFlowInstance, setLocalCursor],
  )

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (event, node, nodes) => {
      onNodeDragStop(event, node, nodes)
      setLocalDragging(null)
    },
    [onNodeDragStop, setLocalDragging],
  )

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const pos = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      setLocalCursor(pos)
    },
    [reactFlowInstance, setLocalCursor],
  )

  const handleMouseLeave = useCallback(() => {
    setLocalCursor(null)
  }, [setLocalCursor])

  const prevSelectionRef = useRef<Array<string>>([])
  const handleSelectionChange = useCallback(
    ({ nodes }: { nodes: Array<Node> }) => {
      const nodeIds = nodes.map((n) => n.id)
      if (
        nodeIds.length !== prevSelectionRef.current.length ||
        nodeIds.some((id, i) => id !== prevSelectionRef.current[i])
      ) {
        prevSelectionRef.current = nodeIds
        setLocalSelection(nodeIds.length > 0 ? nodeIds : null)

        const selectedSet = new Set(nodeIds)
        reactFlowInstance.setNodes((current) =>
          current.map((n) =>
            n.draggable === selectedSet.has(n.id)
              ? n
              : { ...n, draggable: selectedSet.has(n.id) },
          ),
        )
      }
    },
    [setLocalSelection, reactFlowInstance],
  )

  useOnSelectionChange({ onChange: handleSelectionChange })

  const updateNodeData = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      const existing = nodesMap.get(nodeId)
      if (existing) {
        nodesMap.set(nodeId, {
          ...existing,
          data: { ...existing.data, ...data },
        })
      }
    },
    [nodesMap],
  )

  const remoteHighlights = useMemo(() => {
    const map = new Map<string, RemoteHighlight>()
    for (const user of remoteUsers) {
      const nodeIds = user.dragging
        ? Object.keys(user.dragging)
        : user.selectedNodeIds
      if (!nodeIds) continue
      for (const nodeId of nodeIds) {
        if (!map.has(nodeId)) {
          map.set(nodeId, { color: user.user.color, name: user.user.name })
        }
      }
    }
    return map
  }, [remoteUsers])

  const canvasContextValue = useMemo(
    () => ({ updateNodeData, remoteHighlights }),
    [updateNodeData, remoteHighlights],
  )

  const toolCursor =
    activeTool === 'draw'
      ? 'crosshair'
      : activeTool === 'erase'
        ? 'cell'
        : activeTool === 'lasso'
          ? 'crosshair'
          : activeTool === 'rectangle'
            ? 'crosshair'
            : activeTool === 'hand'
              ? 'grab'
              : undefined

  const panOnDrag = isHandMode ? PAN_BOTH : PAN_MIDDLE_ONLY
  const nodesDraggable = false
  const nodesConnectable = canEdit && isSelectMode
  const elementsSelectable = canEdit && isSelectMode

  return (
    <CanvasContext value={canvasContextValue}>
      <div className="flex-1 min-h-0 relative">
        <CanvasToolbar nodesMap={nodesMap} canEdit={canEdit} />
        <ReactFlow
          defaultNodes={EMPTY_NODES}
          defaultEdges={EMPTY_EDGES}
          onNodeDragStart={isSelectMode ? onNodeDragStart : undefined}
          onNodeDrag={isSelectMode ? handleNodeDrag : undefined}
          onNodeDragStop={isSelectMode ? handleNodeDragStop : undefined}
          onNodesDelete={isSelectMode ? onNodesDelete : undefined}
          onEdgesDelete={isSelectMode ? onEdgesDelete : undefined}
          onConnect={isSelectMode ? onConnect : undefined}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          nodeTypes={canvasNodeTypes}
          nodesDraggable={nodesDraggable}
          nodesConnectable={nodesConnectable}
          elementsSelectable={elementsSelectable}
          selectionOnDrag={canEdit && isSelectMode}
          selectionMode={SelectionMode.Partial}
          selectionKeyCode={SELECTION_KEY_DISABLED}
          panOnDrag={panOnDrag}
          deleteKeyCode={
            canEdit && isSelectMode ? DELETE_KEYS : DELETE_KEYS_NONE
          }
          colorMode={colorMode}
          fitView
          proOptions={PRO_OPTIONS}
        >
          <Background bgColor="var(--background)" />
          <MiniMap zoomable={false} pannable={false} />
          <ViewportPortal>
            <CanvasStrokes remoteUsers={remoteUsers} />
            <CanvasRemoteCursors remoteUsers={remoteUsers} />
            <SelectionOverlays
              lassoPath={lassoPath}
              selectionRect={selectionRect}
              remoteUsers={remoteUsers}
            />
          </ViewportPortal>
        </ReactFlow>

        {overlayHandlers && (
          <div
            className="absolute inset-0 z-[5]"
            style={{ cursor: toolCursor }}
            onPointerDown={overlayHandlers.onPointerDown}
            onPointerMove={overlayHandlers.onPointerMove}
            onPointerUp={overlayHandlers.onPointerUp}
          />
        )}
      </div>
    </CanvasContext>
  )
}

const SELECTION_STYLE = {
  fill: 'var(--primary)',
  fillOpacity: 0.08,
  stroke: 'var(--primary)',
  strokeWidth: 1.5,
  strokeDasharray: '6 3',
} as const

function SelectionOverlays({
  lassoPath,
  selectionRect,
  remoteUsers,
}: {
  lassoPath: Array<{ x: number; y: number }>
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
          points={lassoPath.map((p) => `${p.x},${p.y}`).join(' ')}
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

      {remoteUsers.map((user) => {
        if (!user.selecting) return null
        const s = user.selecting
        if (s.type === 'rect') {
          return (
            <rect
              key={`sel-${user.clientId}`}
              x={s.x}
              y={s.y}
              width={s.width}
              height={s.height}
              fill={user.user.color}
              fillOpacity={0.06}
              stroke={user.user.color}
              strokeWidth={1.5}
              strokeDasharray="6 3"
            />
          )
        }
        if (s.type === 'lasso' && s.points.length >= 2) {
          return (
            <polyline
              key={`sel-${user.clientId}`}
              points={s.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill={user.user.color}
              fillOpacity={0.06}
              stroke={user.user.color}
              strokeWidth={1.5}
              strokeDasharray="6 3"
            />
          )
        }
        return null
      })}
    </svg>
  )
}
