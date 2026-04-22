import { useReactFlow } from '@xyflow/react'
import type { CanvasFlowShellProps } from '../components/canvas-flow-shell'
import type { Id } from 'convex/_generated/dataModel'
import type { Edge, Node } from '@xyflow/react'
import { useEffect, useRef } from 'react'
import type * as Y from 'yjs'
import { useCanvasDocumentProjection } from './document/use-canvas-document-projection'
import { useCanvasDocumentWriter } from './document/use-canvas-document-writer'
import { useCanvasHistory } from './document/use-canvas-history'
import { useCanvasKeyboardShortcuts } from './document/use-canvas-keyboard-shortcuts'
import { getCanvasInteractionChrome } from './interaction/use-canvas-interaction-chrome'
import { useCanvasRemoteDragAnimation } from './interaction/use-canvas-remote-drag-animation'
import { useCanvasShellRuntime } from './interaction/use-canvas-shell-runtime'
import { useCanvasSurfaceRuntime } from './interaction/use-canvas-surface-runtime'
import { useCanvasSelectionActions } from './selection/use-canvas-selection-actions'
import { clearCanvasSelectionState } from './selection/use-canvas-selection-state'
import { useCanvasSessionState } from './session/use-canvas-session-state'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'

type CanvasFlowRuntimeShellProps = Omit<CanvasFlowShellProps, 'viewportPersistence'>

interface UseCanvasFlowControllerOptions {
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  canvasId: Id<'sidebarItems'>
  campaignId: Id<'campaigns'>
  canvasParentId: Id<'sidebarItems'> | null
  canEdit: boolean
  provider: ConvexYjsProvider | null
  doc: Y.Doc
}

interface CanvasFlowControllerResult {
  shellProps: CanvasFlowRuntimeShellProps
  canEdit: boolean
  history: ReturnType<typeof useCanvasHistory>
  editSession: ReturnType<typeof useCanvasSessionState>['editSession']
  nodeActions: ReturnType<typeof useCanvasShellRuntime>['nodeActions']
  remoteHighlights: ReturnType<typeof useCanvasSessionState>['remoteHighlights']
}

export function useCanvasFlowController({
  nodesMap,
  edgesMap,
  canvasId,
  campaignId,
  canvasParentId,
  canEdit,
  provider,
  doc,
}: UseCanvasFlowControllerOptions): CanvasFlowControllerResult {
  const session = useCanvasSessionState({ provider })
  const activeToolId = useCanvasToolStore((state) => state.activeTool)
  const reactFlowInstance = useReactFlow()
  const canvasSurfaceRef = useRef<HTMLDivElement>(null)
  const selectionController = useCanvasSelectionActions()
  const localDraggingIdsRef = useRef(new Set<string>())
  const remoteDragAnimation = useCanvasRemoteDragAnimation({
    localDraggingIdsRef,
    remoteDragPositions: session.remoteDragPositions,
  })

  useEffect(() => {
    return () => clearCanvasSelectionState()
  }, [canvasId])

  const documentWriter = useCanvasDocumentWriter({
    nodesMap,
    edgesMap,
  })

  useCanvasDocumentProjection({
    nodesMap,
    edgesMap,
    localDraggingIdsRef,
    remoteResizeDimensions: session.remoteResizeDimensions,
    remoteDragAnimation,
  })

  const history = useCanvasHistory({
    nodesMap,
    edgesMap,
    selection: selectionController,
  })

  useCanvasKeyboardShortcuts({
    ...history,
    canEdit,
    nodesMap,
    edgesMap,
    selection: selectionController,
  })

  const shellRuntime = useCanvasShellRuntime({
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
  })
  const surfaceRuntime = useCanvasSurfaceRuntime({
    canvasId,
    canEdit,
    activeToolId,
    canvasSurfaceRef,
    session,
    selectionController,
    documentWriter,
    history,
    reactFlowInstance,
    dragHandlers: shellRuntime.dragHandlers,
    cursorPresence: shellRuntime.cursorPresence,
  })

  const shellProps: CanvasFlowRuntimeShellProps = {
    chrome: getCanvasInteractionChrome({
      activeTool: activeToolId,
      dropTarget: surfaceRuntime.dropTarget,
      remoteUsers: session.remoteUsers,
      toolCursor: surfaceRuntime.toolCursor,
    }),
    canvasSurfaceRef,
    contextMenu: shellRuntime.contextMenu,
    flowHandlers: surfaceRuntime.flowHandlers,
  }

  return {
    shellProps,
    canEdit,
    history,
    editSession: session.editSession,
    nodeActions: shellRuntime.nodeActions,
    remoteHighlights: session.remoteHighlights,
  }
}
