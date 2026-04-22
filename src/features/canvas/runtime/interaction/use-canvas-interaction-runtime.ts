import type { RefObject } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasCursorPresence } from './use-canvas-cursor-presence'
import { useCanvasDropIntegration } from './use-canvas-drop-integration'
import type { useCanvasHistory } from '../document/use-canvas-history'
import { useCanvasFlowHandlers } from './use-canvas-flow-handlers'
import { getCanvasInteractionChrome } from './use-canvas-interaction-chrome'
import { useCanvasNodeActions } from './use-canvas-node-actions'
import { useCanvasNodeDragHandlers } from './use-canvas-node-drag-handlers'
import { useCanvasPointerBridge } from './use-canvas-pointer-bridge'
import { useCanvasSelectionRect } from '../selection/use-canvas-selection-rect'
import { useCanvasSurfaceClickGuard } from './use-canvas-surface-click-guard'
import { useCanvasSelectionSync } from '../selection/use-canvas-selection-sync'
import { useCanvasToolRuntime } from './use-canvas-tool-runtime'
import { useCanvasWheel } from './use-canvas-wheel'
import { transactCanvasMaps } from '../document/canvas-yjs-transactions'
import { useCanvasPreview } from '~/features/previews/hooks/use-canvas-preview'
import type { CanvasFlowShellProps } from '../../components/canvas-flow-shell'
import type { Id } from 'convex/_generated/dataModel'
import type {
  CanvasDocumentWriter,
  CanvasSelectionController,
  CanvasToolId,
} from '../../tools/canvas-tool-types'
import type { CanvasSessionRuntime } from '../session/use-canvas-session-state'
import type { CanvasRemoteDragAnimation } from './use-canvas-remote-drag-animation'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'

type CanvasFlowRuntimeShellProps = Omit<CanvasFlowShellProps, 'viewportPersistence'>

interface UseCanvasInteractionRuntimeOptions {
  canvasId: Id<'sidebarItems'>
  campaignId: Id<'campaigns'>
  canvasParentId: Id<'sidebarItems'> | null
  canEdit: boolean
  activeToolId: CanvasToolId
  doc: Y.Doc
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  canvasSurfaceRef: RefObject<HTMLDivElement | null>
  session: CanvasSessionRuntime
  selectionController: CanvasSelectionController
  documentWriter: CanvasDocumentWriter
  history: ReturnType<typeof useCanvasHistory>
  localDraggingIdsRef: RefObject<Set<string>>
  remoteDragAnimation: CanvasRemoteDragAnimation
}

export function useCanvasInteractionRuntime({
  canvasId,
  campaignId,
  canvasParentId,
  canEdit,
  activeToolId,
  doc,
  nodesMap,
  edgesMap,
  canvasSurfaceRef,
  session,
  selectionController,
  documentWriter,
  history,
  localDraggingIdsRef,
  remoteDragAnimation,
}: UseCanvasInteractionRuntimeOptions) {
  const reactFlowInstance = useReactFlow()
  const isSelectMode = activeToolId === 'select'
  const query = {
    getNodes: () => reactFlowInstance.getNodes(),
    getEdges: () => reactFlowInstance.getEdges(),
  }
  const interaction = useCanvasSurfaceClickGuard(canvasSurfaceRef)

  useCanvasSelectionRect({
    surfaceRef: canvasSurfaceRef,
    awareness: session.awareness.presence,
    selection: selectionController,
    interaction,
    enabled: canEdit && isSelectMode,
  })

  useCanvasSelectionSync({
    setLocalSelection: session.awareness.core.setLocalSelection,
    onHistorySelectionChange: history.onSelectionChange,
  })

  const { activeToolController, toolCursor } = useCanvasToolRuntime({
    commands: documentWriter,
    query,
    selection: selectionController,
    interaction,
    awareness: session.awareness,
    editSession: session.editSession,
  })

  useCanvasPreview({
    canvasId,
    doc,
    containerRef: canvasSurfaceRef,
  })

  useCanvasPointerBridge({
    surfaceRef: canvasSurfaceRef,
    activeToolController,
  })

  useCanvasWheel(canvasSurfaceRef)

  const { dropOverlayRef, isDropTarget, isFileDropTarget } = useCanvasDropIntegration({
    canvasId,
    canEdit,
    isSelectMode,
    createNode: documentWriter.createNode,
    screenToFlowPosition: reactFlowInstance.screenToFlowPosition,
  })

  const { onNodeDragStart, onNodeDrag, onNodeDragStop } = useCanvasNodeDragHandlers({
    documentWriter,
    nodesDoc: doc,
    remoteDragAnimation,
    awareness: session.awareness.core,
    reactFlowInstance,
    localDraggingIdsRef,
  })

  const { onMouseMove: handleMouseMove, onMouseLeave: handleMouseLeave } = useCanvasCursorPresence({
    reactFlowInstance,
    awareness: session.awareness.core,
  })

  const nodeActions = useCanvasNodeActions({
    documentWriter,
    reactFlowInstance,
    session,
    transact: (fn) => transactCanvasMaps(nodesMap, edgesMap, fn),
  })

  const flowHandlers = useCanvasFlowHandlers({
    activeToolController,
    canEdit,
    cursorPresence: {
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
    },
    documentWriter,
    dragHandlers: { onNodeDragStart, onNodeDrag, onNodeDragStop },
    isSelectMode,
  })

  const shellProps: CanvasFlowRuntimeShellProps = {
    chrome: getCanvasInteractionChrome({
      activeTool: activeToolId,
      dropTarget: {
        overlayRef: dropOverlayRef,
        isTarget: isDropTarget,
        isFileTarget: isFileDropTarget,
      },
      remoteUsers: session.remoteUsers,
      toolCursor,
    }),
    canvasSurfaceRef,
    contextMenu: {
      campaignId,
      canvasParentId,
      nodesMap,
      edgesMap,
      createNode: documentWriter.createNode,
      screenToFlowPosition: reactFlowInstance.screenToFlowPosition,
      selectionController,
    },
    flowHandlers,
  }

  return {
    shellProps,
    nodeActions,
  }
}
