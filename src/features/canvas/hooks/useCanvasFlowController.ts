import { useEffect, useMemo, useRef } from 'react'
import { useCanvasDocumentRuntime } from './useCanvasDocumentRuntime'
import { useCanvasInteractionRuntime } from './useCanvasInteractionRuntime'
import { useCanvasRemoteDragAnimation } from './useCanvasRemoteDragAnimation'
import { useCanvasSelectionActions } from './useCanvasSelectionActions'
import { clearCanvasSelectionState } from './useCanvasSelectionState'
import { useCanvasSessionState } from './useCanvasSessionState'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import type { CanvasFlowShellProps } from '../components/canvas-flow-shell'
import type { CanvasProviderValues } from './canvas-runtime-context'
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
  user: { name: string; color: string }
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
  user,
  doc,
}: UseCanvasFlowControllerOptions): CanvasFlowControllerResult {
  const session = useCanvasSessionState({ provider, user })
  const activeToolId = useCanvasToolStore((state) => state.activeTool)
  const canvasSurfaceRef = useRef<HTMLDivElement>(null)
  const selectionActions = useCanvasSelectionActions()
  const localDraggingIdsRef = useRef(new Set<string>())
  const remoteDragAnimation = useCanvasRemoteDragAnimation({
    localDraggingIdsRef,
    remoteDragPositions: session.remoteDragPositions,
  })

  useEffect(() => {
    return () => clearCanvasSelectionState()
  }, [canvasId])

  const { documentWriter, history } = useCanvasDocumentRuntime({
    nodesMap,
    edgesMap,
    localDraggingIdsRef,
    remoteResizeDimensions: session.remoteResizeDimensions,
    remoteDragAnimation,
  })

  const { shellProps, nodeActions } = useCanvasInteractionRuntime({
    canvasId,
    canEdit,
    activeToolId,
    doc,
    canvasSurfaceRef,
    session,
    selectionActions,
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
