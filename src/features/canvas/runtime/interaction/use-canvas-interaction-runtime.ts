import { useRef } from 'react'
import type { RefObject } from 'react'
import { transactCanvasMaps } from '../document/canvas-yjs-transactions'
import { useCanvasSelectionRect } from '../selection/use-canvas-selection-rect'
import { useCanvasSelectionSync } from '../selection/use-canvas-selection-sync'
import { useCanvasCursorPresence } from './use-canvas-cursor-presence'
import { useCanvasDropIntegration } from './use-canvas-drop-integration'
import { useCanvasFlowHandlers } from './use-canvas-flow-handlers'
import { useCanvasNodeActions } from './use-canvas-node-actions'
import { useCanvasNodeDragHandlers } from './use-canvas-node-drag-handlers'
import { useCanvasPointerBridge } from './use-canvas-pointer-bridge'
import { useCanvasSurfaceClickGuard } from './use-canvas-surface-click-guard'
import { useCanvasToolRuntime } from './use-canvas-tool-runtime'
import { useCanvasWheel } from './use-canvas-wheel'
import type { CanvasFlowShellProps } from '../../components/canvas-flow-shell'
import type {
  CanvasDocumentWriter,
  CanvasSelectionController,
  CanvasToolId,
} from '../../tools/canvas-tool-types'
import type { CanvasSessionRuntime } from '../session/use-canvas-session-state'
import type { useCanvasHistory } from '../document/use-canvas-history'
import type { CanvasRemoteDragAnimation } from './use-canvas-remote-drag-animation'
import type { Id } from 'convex/_generated/dataModel'
import type { Edge, Node, ReactFlowInstance } from '@xyflow/react'
import type * as Y from 'yjs'
import { useYjsPreviewUpload } from '~/features/previews/hooks/use-yjs-preview-upload'

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
  session: CanvasSessionRuntime
  selectionController: CanvasSelectionController
  documentWriter: CanvasDocumentWriter
  history: ReturnType<typeof useCanvasHistory>
  localDraggingIdsRef: RefObject<Set<string>>
  remoteDragAnimation: CanvasRemoteDragAnimation
  reactFlowInstance: ReactFlowInstance
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
  session,
  selectionController,
  documentWriter,
  history,
  localDraggingIdsRef,
  remoteDragAnimation,
  reactFlowInstance,
}: UseCanvasInteractionRuntimeOptions) {
  const canvasSurfaceRef = useRef<HTMLDivElement>(null)
  const isSelectMode = activeToolId === 'select'

  useYjsPreviewUpload({
    itemId: canvasId,
    doc,
    containerRef: canvasSurfaceRef,
    resolveElement: (container) => container,
  })

  const dragHandlers = useCanvasNodeDragHandlers({
    documentWriter,
    nodesDoc: doc,
    remoteDragAnimation,
    awareness: session.awareness.core,
    reactFlowInstance,
    localDraggingIdsRef,
  })

  const cursorPresence = useCanvasCursorPresence({
    reactFlowInstance,
    awareness: session.awareness.core,
  })

  const nodeActions = useCanvasNodeActions({
    documentWriter,
    reactFlowInstance,
    session,
    transact: (fn) => transactCanvasMaps(nodesMap, edgesMap, fn),
  })

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
    query: {
      getNodes: () => reactFlowInstance.getNodes(),
      getEdges: () => reactFlowInstance.getEdges(),
    },
    selection: selectionController,
    interaction,
    awareness: session.awareness,
    editSession: session.editSession,
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

  const flowHandlers = useCanvasFlowHandlers({
    activeToolController,
    canEdit,
    cursorPresence,
    documentWriter,
    dragHandlers,
    isSelectMode,
  })

  return {
    shellProps: {
      chrome: {
        activeTool: activeToolId,
        dropTarget: {
          overlayRef: dropOverlayRef,
          isTarget: isDropTarget,
          isFileTarget: isFileDropTarget,
        },
        remoteUsers: session.remoteUsers,
        toolCursor,
      },
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
    } satisfies CanvasFlowRuntimeShellProps,
    nodeActions,
  }
}
