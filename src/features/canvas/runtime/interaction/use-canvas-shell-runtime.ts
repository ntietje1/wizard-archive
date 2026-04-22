import type { RefObject } from 'react'
import { transactCanvasMaps } from '../document/canvas-yjs-transactions'
import { useCanvasCursorPresence } from './use-canvas-cursor-presence'
import { useCanvasNodeActions } from './use-canvas-node-actions'
import { useCanvasNodeDragHandlers } from './use-canvas-node-drag-handlers'
import type { CanvasFlowShellProps } from '../../components/canvas-flow-shell'
import type { CanvasDocumentWriter, CanvasSelectionController } from '../../tools/canvas-tool-types'
import type { CanvasSessionRuntime } from '../session/use-canvas-session-state'
import type { CanvasRemoteDragAnimation } from './use-canvas-remote-drag-animation'
import type { Id } from 'convex/_generated/dataModel'
import type { Edge, Node, ReactFlowInstance } from '@xyflow/react'
import type * as Y from 'yjs'
import { useYjsPreviewUpload } from '~/features/previews/hooks/use-yjs-preview-upload'

type CanvasFlowRuntimeShellProps = Omit<CanvasFlowShellProps, 'viewportPersistence'>

interface UseCanvasShellRuntimeOptions {
  canvasId: Id<'sidebarItems'>
  campaignId: Id<'campaigns'>
  canvasParentId: Id<'sidebarItems'> | null
  doc: Y.Doc
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  canvasSurfaceRef: RefObject<HTMLDivElement | null>
  session: CanvasSessionRuntime
  selectionController: CanvasSelectionController
  documentWriter: CanvasDocumentWriter
  localDraggingIdsRef: RefObject<Set<string>>
  remoteDragAnimation: CanvasRemoteDragAnimation
  reactFlowInstance: ReactFlowInstance
}

export function useCanvasShellRuntime({
  canvasId,
  campaignId,
  canvasParentId,
  doc,
  nodesMap,
  edgesMap,
  canvasSurfaceRef,
  session,
  selectionController,
  documentWriter,
  localDraggingIdsRef,
  remoteDragAnimation,
  reactFlowInstance,
}: UseCanvasShellRuntimeOptions) {
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

  const contextMenu: CanvasFlowRuntimeShellProps['contextMenu'] = {
    campaignId,
    canvasParentId,
    nodesMap,
    edgesMap,
    createNode: documentWriter.createNode,
    screenToFlowPosition: reactFlowInstance.screenToFlowPosition,
    selectionController,
  }

  return {
    contextMenu,
    cursorPresence,
    dragHandlers,
    nodeActions,
  }
}
