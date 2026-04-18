import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasDocumentSync } from './useCanvasDocumentSync'
import { useCanvasDropTarget } from './useCanvasDropTarget'
import { useCanvasHistory } from './useCanvasHistory'
import { useCanvasInteractionStore } from './useCanvasInteractionStore'
import { useCanvasKeyboardShortcuts } from './useCanvasKeyboardShortcuts'
import { useCanvasSelectionRect } from './useCanvasSelectionRect'
import { useCanvasSelectionSync } from './useCanvasSelectionSync'
import { useCanvasSessionState } from './useCanvasSessionState'
import { useCanvasToolRuntime } from './useCanvasToolRuntime'
import { useCanvasWheel } from './useCanvasWheel'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import { useCanvasPreview } from '~/features/previews/hooks/use-canvas-preview'
import type { CanvasFlowShellProps } from '../components/canvas-flow-shell'
import type { CanvasRuntimeContextValue } from './canvas-runtime-context'
import type { Id } from 'convex/_generated/dataModel'
import type { Edge, Node, OnNodeDrag } from '@xyflow/react'
import type * as Y from 'yjs'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'

const NOOP = () => {}

interface UseCanvasFlowControllerOptions {
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  canvasId: Id<'sidebarItems'>
  canEdit: boolean
  provider: ConvexYjsProvider | null
  user: { name: string; color: string }
  doc: Y.Doc
}

interface CanvasFlowControllerResult {
  runtime: CanvasRuntimeContextValue
  shellProps: CanvasFlowShellProps
}

export function useCanvasFlowController({
  nodesMap,
  edgesMap,
  canvasId,
  canEdit,
  provider,
  user,
  doc,
}: UseCanvasFlowControllerOptions): CanvasFlowControllerResult {
  const reactFlowInstance = useReactFlow()
  const session = useCanvasSessionState({ provider, user })
  const lassoPath = useCanvasInteractionStore((state) => state.lassoPath)
  const selectionRect = useCanvasInteractionStore((state) => state.selectionRect)
  const activeToolId = useCanvasToolStore((state) => state.activeTool)

  const { documentActions, reactFlowHandlers } = useCanvasDocumentSync({
    nodesMap,
    edgesMap,
    remoteDragPositions: session.remoteDragPositions,
    remoteResizeDimensions: session.remoteResizeDimensions,
  })

  const history = useCanvasHistory({ nodesMap, edgesMap })
  useCanvasKeyboardShortcuts(history)

  useCanvasSelectionRect({
    setLocalSelecting: session.awareness.setLocalSelecting,
    enabled: canEdit && activeToolId === 'select',
  })

  useCanvasSelectionSync({
    setLocalSelection: session.awareness.setLocalSelection,
    onHistorySelectionChange: history.onSelectionChange,
    editingEmbedId: session.editSession.editingEmbedId,
    setEditingEmbedId: session.editSession.setEditingEmbedId,
  })

  const { activeToolController, activeToolModule } = useCanvasToolRuntime({
    canvasId,
    canEdit,
    documentActions,
    awareness: session.awareness,
    editSession: session.editSession,
  })

  const wrapperRef = useRef<HTMLDivElement>(null)
  const [wrapperElement, setWrapperElement] = useState<HTMLDivElement | null>(null)
  const wrapperCallbackRef = useCallback((node: HTMLDivElement | null) => {
    wrapperRef.current = node
    setWrapperElement(node)
  }, [])
  const toolControllerRef = useRef(activeToolController)
  toolControllerRef.current = activeToolController

  useEffect(() => {
    if (!wrapperElement) return

    const onPointerDown = (event: PointerEvent) => {
      const controller = toolControllerRef.current
      if (!controller.onPointerDown || event.button !== 0) return
      if (
        !event.target ||
        !(event.target instanceof Element) ||
        !event.target.closest('.react-flow')
      )
        return
      controller.onPointerDown(event)
    }

    const onPointerMove = (event: PointerEvent) => {
      toolControllerRef.current.onPointerMove?.(event)
    }

    const onPointerUp = (event: PointerEvent) => {
      toolControllerRef.current.onPointerUp?.(event)
    }

    const onPointerCancel = (event: PointerEvent) => {
      toolControllerRef.current.onPointerCancel?.(event)
    }

    wrapperElement.addEventListener('pointerdown', onPointerDown)
    wrapperElement.addEventListener('pointermove', onPointerMove)
    wrapperElement.addEventListener('pointerup', onPointerUp)
    wrapperElement.addEventListener('pointercancel', onPointerCancel)
    return () => {
      wrapperElement.removeEventListener('pointerdown', onPointerDown)
      wrapperElement.removeEventListener('pointermove', onPointerMove)
      wrapperElement.removeEventListener('pointerup', onPointerUp)
      wrapperElement.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [wrapperElement])

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

  const isSelectMode = activeToolId === 'select'
  const { dropOverlayRef, isDropTarget, isFileDropTarget } = useCanvasDropTarget({
    canvasId,
    canEdit,
    isSelectMode,
    createNode: documentActions.createNode,
    screenToFlowPosition: reactFlowInstance.screenToFlowPosition,
  })

  const handleNodeDrag: OnNodeDrag = useCallback(
    (event, _node, nodes) => {
      session.awareness.setLocalDragging(
        Object.fromEntries(nodes.map((node) => [node.id, node.position])),
      )
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      session.awareness.setLocalCursor(position)
    },
    [reactFlowInstance, session.awareness],
  )

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (event, node, nodes) => {
      reactFlowHandlers.onNodeDragStop(event, node, nodes)
      session.awareness.setLocalDragging(null)
    },
    [reactFlowHandlers, session.awareness],
  )

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      session.awareness.setLocalCursor(position)
    },
    [reactFlowInstance, session.awareness],
  )

  const handleMouseLeave = useCallback(() => {
    session.awareness.setLocalCursor(null)
  }, [session.awareness])

  const nodeActions = useMemo(
    () => ({
      updateNodeData: documentActions.updateNodeData,
      onResize: (
        nodeId: string,
        width: number,
        height: number,
        position: { x: number; y: number },
      ) => {
        session.awareness.setLocalResizing({
          [nodeId]: { width, height, x: position.x, y: position.y },
        })
      },
      onResizeEnd: (
        nodeId: string,
        width: number,
        height: number,
        position: { x: number; y: number },
      ) => {
        session.awareness.setLocalResizing(null)
        documentActions.resizeNode(nodeId, width, height, position)
      },
    }),
    [documentActions, session.awareness],
  )

  const runtime: CanvasRuntimeContextValue = useMemo(
    () => ({
      canEdit,
      user,
      remoteHighlights: session.remoteHighlights,
      history,
      editSession: session.editSession,
      nodeActions,
    }),
    [canEdit, history, nodeActions, session.editSession, session.remoteHighlights, user],
  )

  const shellProps: CanvasFlowShellProps = {
    toolCursor: activeToolModule.cursor,
    wrapperRef: wrapperCallbackRef,
    remoteUsers: session.remoteUsers,
    lassoPath,
    selectionRect,
    activeTool: activeToolId,
    onNodeDragStart: isSelectMode ? reactFlowHandlers.onNodeDragStart : undefined,
    onNodeDrag: isSelectMode ? handleNodeDrag : undefined,
    onNodeDragStop: isSelectMode ? handleNodeDragStop : undefined,
    onNodesDelete: isSelectMode ? reactFlowHandlers.onNodesDelete : undefined,
    onEdgesDelete: isSelectMode ? reactFlowHandlers.onEdgesDelete : undefined,
    onConnect: isSelectMode ? reactFlowHandlers.onConnect : undefined,
    onMoveStart: activeToolController.onMoveStart ?? NOOP,
    onMoveEnd: activeToolController.onMoveEnd ?? NOOP,
    onPaneClick: activeToolController.onPaneClick ?? NOOP,
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
    dropOverlayRef,
    isDropTarget,
    isFileDropTarget,
  }

  return {
    runtime,
    shellProps,
  }
}
