import type { RefObject } from 'react'
import { useCanvasDropIntegration } from './use-canvas-drop-integration'
import { useCanvasFlowHandlers } from './use-canvas-flow-handlers'
import { useCanvasPointerBridge } from './use-canvas-pointer-bridge'
import { useCanvasSurfaceClickGuard } from './use-canvas-surface-click-guard'
import { useCanvasToolRuntime } from './use-canvas-tool-runtime'
import { useCanvasWheel } from './use-canvas-wheel'
import type { useCanvasHistory } from '../document/use-canvas-history'
import { useCanvasSelectionRect } from '../selection/use-canvas-selection-rect'
import { useCanvasSelectionSync } from '../selection/use-canvas-selection-sync'
import type { CanvasFlowShellProps } from '../../components/canvas-flow-shell'
import type {
  CanvasDocumentWriter,
  CanvasSelectionController,
  CanvasToolId,
} from '../../tools/canvas-tool-types'
import type { CanvasSessionRuntime } from '../session/use-canvas-session-state'
import type { Id } from 'convex/_generated/dataModel'
import type { ReactFlowInstance } from '@xyflow/react'

type CanvasFlowRuntimeShellProps = Omit<CanvasFlowShellProps, 'viewportPersistence'>

interface UseCanvasSurfaceRuntimeOptions {
  canvasId: Id<'sidebarItems'>
  canEdit: boolean
  activeToolId: CanvasToolId
  canvasSurfaceRef: RefObject<HTMLDivElement | null>
  session: CanvasSessionRuntime
  selectionController: CanvasSelectionController
  documentWriter: CanvasDocumentWriter
  history: ReturnType<typeof useCanvasHistory>
  reactFlowInstance: Pick<ReactFlowInstance, 'getEdges' | 'getNodes' | 'screenToFlowPosition'>
  dragHandlers: {
    onNodeDragStart: NonNullable<CanvasFlowRuntimeShellProps['flowHandlers']['onNodeDragStart']>
    onNodeDrag: NonNullable<CanvasFlowRuntimeShellProps['flowHandlers']['onNodeDrag']>
    onNodeDragStop: NonNullable<CanvasFlowRuntimeShellProps['flowHandlers']['onNodeDragStop']>
  }
  cursorPresence: {
    onMouseLeave: CanvasFlowRuntimeShellProps['flowHandlers']['onMouseLeave']
    onMouseMove: CanvasFlowRuntimeShellProps['flowHandlers']['onMouseMove']
  }
}

export function useCanvasSurfaceRuntime({
  canvasId,
  canEdit,
  activeToolId,
  canvasSurfaceRef,
  session,
  selectionController,
  documentWriter,
  history,
  reactFlowInstance,
  dragHandlers,
  cursorPresence,
}: UseCanvasSurfaceRuntimeOptions) {
  const isSelectMode = activeToolId === 'select'
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
    dropTarget: {
      overlayRef: dropOverlayRef,
      isTarget: isDropTarget,
      isFileTarget: isFileDropTarget,
    },
    flowHandlers,
    toolCursor,
  }
}
