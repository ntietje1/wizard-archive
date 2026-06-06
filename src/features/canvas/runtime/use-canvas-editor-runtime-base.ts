import type { Id } from 'convex/_generated/dataModel'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useLayoutEffect } from 'react'
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
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../domain/canvas-document'
import type { CanvasToolHandlers } from '../tools/canvas-tool-types'
import type { CanvasConnection, CanvasViewport } from '../types/canvas-domain-types'
import type { useCanvasCursorPresence } from './interaction/use-canvas-cursor-presence'
import type { ConvexYjsProvider } from '~/shared/collaboration/convex-yjs-provider'

interface UseCanvasEditorRuntimeBaseOptions {
  nodesMap: Y.Map<CanvasDocumentNode>
  edgesMap: Y.Map<CanvasDocumentEdge>
  canvasId: Id<'sidebarItems'>
  canEdit: boolean
  provider: ConvexYjsProvider | null
  initialViewport: CanvasViewport
}

export function useCanvasEditorRuntimeBase({
  nodesMap,
  edgesMap,
  canvasId,
  canEdit,
  provider,
  initialViewport,
}: UseCanvasEditorRuntimeBaseOptions) {
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
  const document = useCanvasDocumentRuntime({
    canEdit,
    canvasSurfaceRef: core.canvasSurfaceRef,
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

  return {
    activeTool: useCanvasToolStore((state) => state.activeTool),
    canvasEngine: core.canvasEngine,
    canvasSurfaceRef: core.canvasSurfaceRef,
    document,
    domRuntime: core.domRuntime,
    modifiers: useCanvasModifierKeys(),
    pointerRouter: useCanvasPointerRouterController(),
    selection,
    session,
    viewportController: core.viewportController,
  }
}

interface UseCanvasEditorSceneRuntimeOptions {
  activeTool: ReturnType<typeof useCanvasEditorRuntimeBase>['activeTool']
  activeToolHandlers: CanvasToolHandlers
  canvasEngine: ReturnType<typeof useCanvasEditorRuntimeBase>['canvasEngine']
  canvasId: Id<'sidebarItems'>
  canvasSurfaceRef: ReturnType<typeof useCanvasEditorRuntimeBase>['canvasSurfaceRef']
  canEdit: boolean
  createEdgeFromConnection: (connection: CanvasConnection) => void
  cursorPresence: ReturnType<typeof useCanvasCursorPresence>
  doc: Y.Doc
  documentWriter: ReturnType<typeof useCanvasEditorRuntimeBase>['document']['documentWriter']
  edgesMap: Y.Map<CanvasDocumentEdge>
  modifiers: ReturnType<typeof useCanvasEditorRuntimeBase>['modifiers']
  nodesMap: Y.Map<CanvasDocumentNode>
  pointerRouter: ReturnType<typeof useCanvasEditorRuntimeBase>['pointerRouter']
  selection: ReturnType<typeof useCanvasEditorRuntimeBase>['selection']
  session: ReturnType<typeof useCanvasEditorRuntimeBase>['session']
  viewportController: ReturnType<typeof useCanvasEditorRuntimeBase>['viewportController']
}

export function useCanvasEditorSceneRuntime({
  activeTool,
  activeToolHandlers,
  canvasEngine,
  canvasId,
  canvasSurfaceRef,
  canEdit,
  createEdgeFromConnection,
  cursorPresence,
  doc,
  documentWriter,
  edgesMap,
  modifiers,
  nodesMap,
  pointerRouter,
  selection,
  session,
  viewportController,
}: UseCanvasEditorSceneRuntimeOptions) {
  const interaction = useCanvasInteractionRuntime({
    activeTool,
    activeToolHandlers,
    canvasEngine,
    canvasId,
    canvasSurfaceRef,
    canEdit,
    doc,
    documentWriter,
    edgesMap,
    modifiers,
    nodesMap,
    pointerRouter,
    selection,
    session,
    viewportController,
  })

  useCanvasDocumentProjection({
    canvasEngine,
    nodesMap,
    edgesMap,
    localDraggingIdsRef: interaction.localDraggingIdsRef,
    remoteResizeDimensions: session.remoteResizeDimensions,
  })

  const canUsePointerTool = activeTool === 'select'

  return {
    activeToolHandlers,
    cursorPresence,
    createEdgeFromConnection,
    onNodeClick: (event: ReactMouseEvent, node: CanvasDocumentNode) => {
      if (!canUsePointerTool) return
      activeToolHandlers.onNodeClick?.(event, node)
    },
    onEdgeClick: (event: ReactMouseEvent, edge: CanvasDocumentEdge) => {
      if (!canUsePointerTool) return
      activeToolHandlers.onEdgeClick?.(event, edge)
    },
    onMouseMove: cursorPresence.onMouseMove,
    onMouseLeave: cursorPresence.onMouseLeave,
  }
}
