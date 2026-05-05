import type { Id } from 'convex/_generated/dataModel'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useLayoutEffect, useMemo } from 'react'
import type * as Y from 'yjs'
import { useCanvasDocumentProjection } from './document/use-canvas-document-projection'
import { useCanvasModifierKeys } from './interaction/use-canvas-modifier-keys'
import { useCanvasPointerRouterController } from './interaction/use-canvas-pointer-router'
import { useCanvasSessionState } from './session/use-canvas-session-state'
import { useCanvasCoreRuntime } from './use-canvas-core-runtime'
import { useCanvasDocumentRuntime } from './use-canvas-document-runtime'
import {
  useCanvasInteractionRuntime,
  useCanvasSelectionRuntime,
} from './use-canvas-interaction-runtime'
import { useCanvasToolRuntime } from './use-canvas-tool-runtime'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import type { CanvasViewport } from '../types/canvas-domain-types'
import type { CanvasDocumentEdge, CanvasDocumentNode } from 'convex/canvases/validation'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'
import { useYjsPreviewUpload } from '~/features/previews/hooks/use-yjs-preview-upload'

interface UseCanvasEditorRuntimeOptions {
  nodesMap: Y.Map<CanvasDocumentNode>
  edgesMap: Y.Map<CanvasDocumentEdge>
  canvasId: Id<'sidebarItems'>
  campaignId: Id<'campaigns'>
  canvasParentId: Id<'sidebarItems'> | null
  canEdit: boolean
  provider: ConvexYjsProvider | null
  doc: Y.Doc
  initialViewport: CanvasViewport
}

export function useCanvasEditorRuntime({
  nodesMap,
  edgesMap,
  canvasId,
  campaignId,
  canvasParentId,
  canEdit,
  provider,
  doc,
  initialViewport,
}: UseCanvasEditorRuntimeOptions) {
  const session = useCanvasSessionState({ provider })
  const core = useCanvasCoreRuntime({
    canvasId,
    initialViewport,
  })
  const { historySelectionChangeRef, selection } = useCanvasSelectionRuntime({
    canvasEngine: core.canvasEngine,
    canvasId,
    setLocalSelection: session.awareness.core.setLocalSelection,
  })

  useYjsPreviewUpload({
    itemId: canvasId,
    doc,
    containerRef: core.canvasSurfaceRef,
    resolveElement: (container) => container,
  })

  const document = useCanvasDocumentRuntime({
    canEdit,
    canvasEngine: core.canvasEngine,
    edgesMap,
    nodesMap,
    selection,
    session,
  })
  useLayoutEffect(() => {
    historySelectionChangeRef.current = document.history.onSelectionChange
    return () => {
      historySelectionChangeRef.current = () => undefined
    }
  }, [document.history.onSelectionChange, historySelectionChangeRef])

  const modifiers = useCanvasModifierKeys()
  const pointerRouter = useCanvasPointerRouterController()
  const activeTool = useCanvasToolStore((state) => state.activeTool)
  const tools = useCanvasToolRuntime({
    activeTool,
    campaignId,
    canvasEngine: core.canvasEngine,
    canvasId,
    canvasParentId,
    canEdit,
    commands: document.commands,
    documentWriter: document.documentWriter,
    edgesMap,
    modifiers,
    nodesMap,
    pointerRouter,
    selection,
    session,
    viewportController: core.viewportController,
  })
  const interaction = useCanvasInteractionRuntime({
    activeTool,
    activeToolHandlers: tools.activeToolHandlers,
    canvasEngine: core.canvasEngine,
    canvasId,
    canvasSurfaceRef: core.canvasSurfaceRef,
    canEdit,
    doc,
    documentWriter: document.documentWriter,
    edgesMap,
    modifiers,
    nodesMap,
    pointerRouter,
    selection,
    session,
    viewportController: core.viewportController,
  })

  useCanvasDocumentProjection({
    canvasEngine: core.canvasEngine,
    nodesMap,
    edgesMap,
    localDraggingIdsRef: interaction.localDraggingIdsRef,
    remoteResizeDimensions: session.remoteResizeDimensions,
  })

  const isSelectMode = activeTool === 'select'
  const sceneHandlers = useMemo(
    () => ({
      activeToolHandlers: tools.activeToolHandlers,
      cursorPresence: tools.cursorPresence,
      createEdgeFromConnection: tools.createEdgeFromConnection,
      onNodeClick: (event: ReactMouseEvent, node: CanvasDocumentNode) => {
        if (!canEdit || !isSelectMode) {
          return
        }
        tools.activeToolHandlers.onNodeClick?.(event, node)
      },
      onEdgeClick: (event: ReactMouseEvent, edge: CanvasDocumentEdge) => {
        if (!canEdit || !isSelectMode) {
          return
        }
        tools.activeToolHandlers.onEdgeClick?.(event, edge)
      },
      onMouseMove: tools.cursorPresence.onMouseMove,
      onMouseLeave: tools.cursorPresence.onMouseLeave,
    }),
    [
      canEdit,
      isSelectMode,
      tools.activeToolHandlers,
      tools.createEdgeFromConnection,
      tools.cursorPresence,
    ],
  )

  return {
    activeTool,
    canvasEngine: core.canvasEngine,
    canvasSurfaceRef: core.canvasSurfaceRef,
    commands: document.commands,
    contextMenu: tools.contextMenu,
    documentWriter: document.documentWriter,
    domRuntime: core.domRuntime,
    dropTarget: tools.dropTarget,
    editSession: session.editSession,
    sceneHandlers,
    history: document.history,
    nodeActions: document.nodeActions,
    viewportController: core.viewportController,
    remoteHighlights: session.remoteHighlights,
    remoteUsers: session.remoteUsers,
    selection,
    toolCursor: tools.activeToolSpec.cursor,
  }
}
