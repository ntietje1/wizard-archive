import { useEffect, useMemo, useRef } from 'react'
import { useCanvasDocumentRuntime } from './document/use-canvas-document-runtime'
import { useCanvasInteractionRuntime } from './interaction/use-canvas-interaction-runtime'
import { useCanvasRemoteDragAnimation } from './interaction/use-canvas-remote-drag-animation'
import { useCanvasSelectionActions } from './selection/use-canvas-selection-actions'
import { clearCanvasSelectionState } from './selection/use-canvas-selection-state'
import { useCanvasSessionState } from './session/use-canvas-session-state'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import type { CanvasFlowShellProps } from '../components/canvas-flow-shell'
import type { CanvasProviderValues } from './providers/canvas-runtime-context'
import type { Id } from 'convex/_generated/dataModel'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'

interface UseCanvasFlowControllerOptions {
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  canvasId: Id<'sidebarItems'>
  canEdit: boolean
  provider: ConvexYjsProvider | null
  doc: Y.Doc
}

interface CanvasFlowControllerResult {
  runtime: CanvasProviderValues
  shellProps: CanvasFlowShellProps
}

export function useCanvasFlowController({
  nodesMap,
  edgesMap,
  canvasId,
  canEdit,
  provider,
  doc,
}: UseCanvasFlowControllerOptions): CanvasFlowControllerResult {
  const session = useCanvasSessionState({ provider })
  const activeToolId = useCanvasToolStore((state) => state.activeTool)
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

  const { documentWriter, history } = useCanvasDocumentRuntime({
    canEdit,
    nodesMap,
    edgesMap,
    selection: selectionController,
    localDraggingIdsRef,
    remoteResizeDimensions: session.remoteResizeDimensions,
    remoteDragAnimation,
  })

  const { shellProps, nodeActions } = useCanvasInteractionRuntime({
    canvasId,
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
  })

  const runtime: CanvasProviderValues = useMemo(
    () => ({
      canEdit,
      remoteHighlights: session.remoteHighlights,
      history,
      editSession: session.editSession,
      nodeActions,
    }),
    [canEdit, history, nodeActions, session.editSession, session.remoteHighlights],
  )

  return {
    runtime,
    shellProps,
  }
}
