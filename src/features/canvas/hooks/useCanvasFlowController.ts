import { useCallback, useEffect, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasAwareness } from './useCanvasAwareness'
import { useCanvasDropTarget } from './useCanvasDropTarget'
import { useCanvasDrawing } from './useCanvasDrawing'
import { useCanvasEraser } from './useCanvasEraser'
import { useCanvasHistory } from './useCanvasHistory'
import { useCanvasInteractionStore } from './useCanvasInteractionStore'
import { useCanvasKeyboardShortcuts } from './useCanvasKeyboardShortcuts'
import { useCanvasLassoSelection } from './useCanvasLassoSelection'
import { useCanvasOverlayHandlers } from './useCanvasOverlayHandlers'
import { useCanvasPlacementTool } from './useCanvasPlacementTool'
import { useCanvasPreview } from '~/features/previews/hooks/use-canvas-preview'
import { useCanvasReactFlowSync } from './useCanvasReactFlowSync'
import { useCanvasRectangleDraw } from './useCanvasRectangleDraw'
import { useCanvasSelectionRect } from './useCanvasSelectionRect'
import { useCanvasSelectionSync } from './useCanvasSelectionSync'
import { useCanvasStrokeClick } from './useCanvasStrokeClick'
import { useCanvasWheel } from './useCanvasWheel'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import { getRemoteDragPositions, getRemoteHighlights, getRemoteResizeDimensions } from '../utils/canvas-remote-state'
import type {
  CanvasEditSessionContextValue,
  CanvasNodeActionsContextValue,
  CanvasViewStateContextValue,
} from './useCanvasContext'
import type { Point2D, RemoteUser } from '../utils/canvas-awareness-types'
import type { Bounds } from '../utils/canvas-stroke-utils'
import type { StrokeNodeData } from '../components/nodes/stroke-node'
import type { Id } from 'convex/_generated/dataModel'
import type { Edge, Node, OnConnect, OnEdgesDelete, OnNodeDrag, OnNodesDelete } from '@xyflow/react'
import type * as Y from 'yjs'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'

interface UseCanvasFlowControllerOptions {
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  canvasId: Id<'sidebarItems'>
  canEdit: boolean
  provider: ConvexYjsProvider | null
  user: { name: string; color: string }
  doc: Y.Doc
}

export interface CanvasFlowShellProps {
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

export function useCanvasFlowController({
  nodesMap,
  edgesMap,
  canvasId,
  canEdit,
  provider,
  user,
  doc,
}: UseCanvasFlowControllerOptions) {
  const reactFlowInstance = useReactFlow()
  const [editingEmbedId, setEditingEmbedId] = useState<string | null>(null)
  const [pendingEditNodeId, setPendingEditNodeId] = useState<string | null>(null)
  const {
    remoteUsers,
    setLocalCursor,
    setLocalDragging,
    setLocalResizing,
    setLocalSelection,
    setLocalDrawing,
    setLocalSelecting,
  } = useCanvasAwareness(provider)

  const activeTool = useCanvasToolStore((state) => state.activeTool)
  const completeActiveToolAction = useCanvasToolStore((state) => state.completeActiveToolAction)
  const lassoPath = useCanvasInteractionStore((state) => state.lassoPath)
  const selectionRect = useCanvasInteractionStore((state) => state.selectionRect)

  const isSelectMode = activeTool === 'select'

  const remoteDragPositions = getRemoteDragPositions(remoteUsers)
  const remoteResizeDimensions = getRemoteResizeDimensions(remoteUsers)
  const remoteHighlights = getRemoteHighlights(remoteUsers)

  const { onNodeDragStart, onNodeDragStop, onNodesDelete, onEdgesDelete, onConnect } =
    useCanvasReactFlowSync(nodesMap, edgesMap, remoteDragPositions, remoteResizeDimensions)

  const { onSelectionChange: onHistorySelectionChange } = useCanvasHistory({
    nodesMap,
    edgesMap,
  })

  useCanvasKeyboardShortcuts()

  const drawing = useCanvasDrawing({ nodesMap, setAwarenessDrawing: setLocalDrawing })
  const eraser = useCanvasEraser({ nodesMap })
  const lasso = useCanvasLassoSelection({ setLocalSelecting })
  const rectangleDraw = useCanvasRectangleDraw({ nodesMap })
  const placeTextNode = useCanvasPlacementTool({
    nodesMap,
    type: 'text',
    setPendingEditNodeId,
  })
  const placeStickyNode = useCanvasPlacementTool({
    nodesMap,
    type: 'sticky',
    setPendingEditNodeId,
  })

  useCanvasSelectionRect({
    setLocalSelecting,
    enabled: canEdit && isSelectMode,
  })

  useCanvasSelectionSync({
    setLocalSelection,
    onHistorySelectionChange,
    editingEmbedId,
    setEditingEmbedId,
  })

  const wrapperRef = useRef<HTMLDivElement>(null)
  const [wrapperElement, setWrapperElement] = useState<HTMLDivElement | null>(null)
  const wrapperCallbackRef = useCallback((node: HTMLDivElement | null) => {
    wrapperRef.current = node
    setWrapperElement(node)
  }, [])

  const { toolCursor } = useCanvasOverlayHandlers(wrapperElement, {
    drawing,
    eraser,
    lasso,
    rectangleDraw,
  })

  const onStrokePaneClick = useCanvasStrokeClick()

  useCanvasWheel(wrapperRef)
  const canvasContainerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const wrapper = wrapperElement ?? wrapperRef.current
    if (!wrapper) return

    const element = wrapper.querySelector<HTMLElement>('.react-flow')
    if (element) {
      canvasContainerRef.current = element
      return
    }

    const observer = new MutationObserver(() => {
      const found = wrapper.querySelector<HTMLElement>('.react-flow')
      if (found) {
        canvasContainerRef.current = found
        observer.disconnect()
      }
    })

    observer.observe(wrapper, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [wrapperElement])

  useCanvasPreview({
    canvasId,
    doc,
    containerRef: canvasContainerRef,
  })

  const { dropOverlayRef, isDropTarget, isFileDropTarget } = useCanvasDropTarget({
    nodesMap,
    canvasId,
    canEdit,
    isSelectMode,
  })

  const handleNodeDrag: OnNodeDrag = useCallback(
    (event, _node, nodes) => {
      setLocalDragging(Object.fromEntries(nodes.map((node) => [node.id, node.position])))
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      setLocalCursor(position)
    },
    [reactFlowInstance, setLocalCursor, setLocalDragging],
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
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      setLocalCursor(position)
    },
    [reactFlowInstance, setLocalCursor],
  )

  const handleMouseLeave = useCallback(() => {
    setLocalCursor(null)
  }, [setLocalCursor])

  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (activeTool === 'select') {
        onStrokePaneClick(event)
        return
      }
      if (activeTool === 'text') {
        placeTextNode(event)
        return
      }
      if (activeTool === 'sticky') {
        placeStickyNode(event)
      }
    },
    [activeTool, onStrokePaneClick, placeStickyNode, placeTextNode],
  )

  const updateNodeData = (nodeId: string, data: Record<string, unknown>) => {
    const existing = nodesMap.get(nodeId)
    if (!existing) return

    nodesMap.set(nodeId, {
      ...existing,
      data: { ...existing.data, ...data },
    })
  }

  const handleResize = (
    nodeId: string,
    width: number,
    height: number,
    position: { x: number; y: number },
  ) => {
    setLocalResizing({
      [nodeId]: { width, height, x: position.x, y: position.y },
    })
  }

  const handleResizeEnd = (
    nodeId: string,
    width: number,
    height: number,
    position: { x: number; y: number },
  ) => {
    setLocalResizing(null)
    const existing = nodesMap.get(nodeId)
    if (!existing) return

    if (existing.type === 'stroke' && existing.data?.bounds) {
      const { bounds, points, size } = existing.data as StrokeNodeData
      const safeBoundsWidth = Math.max(bounds.width, 1)
      const safeBoundsHeight = Math.max(bounds.height, 1)
      const scaleX = width / safeBoundsWidth
      const scaleY = height / safeBoundsHeight
      const scaledPoints = points.map(
        ([x, y, pressure]) =>
          [
            bounds.x + (x - bounds.x) * scaleX,
            bounds.y + (y - bounds.y) * scaleY,
            pressure,
          ] as [number, number, number],
      )
      nodesMap.set(nodeId, {
        ...existing,
        width,
        height,
        position,
        data: {
          ...existing.data,
          points: scaledPoints,
          bounds: { ...bounds, width, height },
          size: size * Math.min(scaleX, scaleY),
        },
      })
      return
    }

    nodesMap.set(nodeId, { ...existing, width, height, position })
  }

  const handGestureActiveRef = useRef(false)
  useEffect(() => {
    if (activeTool !== 'hand') {
      handGestureActiveRef.current = false
    }
  }, [activeTool])

  const handleMoveStart = useCallback(
    (event: MouseEvent | TouchEvent | null) => {
      if (activeTool !== 'hand' || !event) return
      handGestureActiveRef.current = true
    },
    [activeTool],
  )

  const handleMoveEnd = useCallback(() => {
    if (!handGestureActiveRef.current || activeTool !== 'hand') return
    handGestureActiveRef.current = false
    completeActiveToolAction()
  }, [activeTool, completeActiveToolAction])

  const nodeActions: CanvasNodeActionsContextValue = {
    updateNodeData,
    onResize: handleResize,
    onResizeEnd: handleResizeEnd,
  }

  const editSession: CanvasEditSessionContextValue = {
    editingEmbedId,
    setEditingEmbedId,
    pendingEditNodeId,
    setPendingEditNodeId,
  }

  const viewState: CanvasViewStateContextValue = {
    remoteHighlights,
    canEdit,
    user,
  }

  const shellProps: CanvasFlowShellProps = {
    toolCursor,
    wrapperRef: wrapperCallbackRef,
    remoteUsers,
    lassoPath,
    selectionRect,
    activeTool,
    onNodeDragStart: isSelectMode ? onNodeDragStart : undefined,
    onNodeDrag: isSelectMode ? handleNodeDrag : undefined,
    onNodeDragStop: isSelectMode ? handleNodeDragStop : undefined,
    onNodesDelete: isSelectMode ? onNodesDelete : undefined,
    onEdgesDelete: isSelectMode ? onEdgesDelete : undefined,
    onConnect: isSelectMode ? onConnect : undefined,
    onMoveStart: handleMoveStart,
    onMoveEnd: handleMoveEnd,
    onPaneClick:
      isSelectMode || activeTool === 'text' || activeTool === 'sticky' ? handlePaneClick : undefined,
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
    dropOverlayRef,
    isDropTarget,
    isFileDropTarget,
  }

  return {
    nodeActions,
    editSession,
    viewState,
    shellProps,
  }
}
