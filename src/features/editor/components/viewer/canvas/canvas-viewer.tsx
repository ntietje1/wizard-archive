import { useCallback, useMemo } from 'react'
import {
  Background,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
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
import type { RemoteHighlight } from './canvas-context'
import type { Edge, Node, OnNodeDrag } from '@xyflow/react'
import type * as Y from 'yjs'
import type { EditorViewerProps } from '../sidebar-item-editor'
import type { CanvasWithContent } from 'convex/canvases/types'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'
import { LoadingSpinner } from '~/shared/components/loading-spinner'
import { useCanvasYjsCollaboration } from '~/features/editor/hooks/useCanvasYjsCollaboration'
import { useYjsReactFlowSync } from '~/features/editor/hooks/useYjsReactFlowSync'
import { useCanvasAwareness } from '~/features/editor/hooks/useCanvasAwareness'
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
  const { remoteUsers, setLocalCursor, setLocalDragging, setLocalSelection } =
    useCanvasAwareness(provider)

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

  const handleSelectionChange = useCallback(
    ({ nodes }: { nodes: Array<Node> }) => {
      setLocalSelection(nodes.length > 0 ? nodes.map((n) => n.id) : null)
    },
    [setLocalSelection],
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

  return (
    <CanvasContext value={canvasContextValue}>
      <div className="flex-1 min-h-0 relative">
        <CanvasToolbar nodesMap={nodesMap} canEdit={canEdit} />
        <ReactFlow
          defaultNodes={EMPTY_NODES}
          defaultEdges={EMPTY_EDGES}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onConnect={onConnect}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          nodeTypes={canvasNodeTypes}
          nodesDraggable={canEdit}
          nodesConnectable={canEdit}
          elementsSelectable={canEdit}
          deleteKeyCode={canEdit ? DELETE_KEYS : DELETE_KEYS_NONE}
          colorMode={colorMode}
          fitView
          proOptions={PRO_OPTIONS}
        >
          <Background bgColor="var(--background)" />
          <MiniMap zoomable={false} pannable={false} />
          <ViewportPortal>
            <CanvasRemoteCursors remoteUsers={remoteUsers} />
          </ViewportPortal>
        </ReactFlow>
      </div>
    </CanvasContext>
  )
}
