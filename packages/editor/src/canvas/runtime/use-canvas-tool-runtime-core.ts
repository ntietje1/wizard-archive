import type { createCanvasDocumentWriter } from './document/use-canvas-document-writer'
import type { useCanvasDocumentCommands } from './document/use-canvas-commands'
import { createCanvasToolRuntime, getEdgeCreationDefaults } from '../tools/canvas-tool-runtime'
import { useCanvasContextMenu } from './context-menu/use-canvas-context-menu'
import { useCanvasCursorPresence } from './interaction/use-canvas-cursor-presence'
import type { useCanvasModifierKeys } from './interaction/use-canvas-modifier-keys'
import type { useCanvasPointerRouterController } from './interaction/use-canvas-pointer-router'
import type { useCanvasSelectionController } from './selection/use-canvas-selection-actions'
import type { useCanvasSessionState } from './session/use-canvas-session-state'
import type { createCanvasEngine } from '../system/canvas-engine'
import type { createCanvasViewportController } from '../system/canvas-viewport-controller'
import { canvasToolSpecs } from '../tools/canvas-tool-modules'
import type { CanvasToolId } from '../tools/canvas-tool-types'
import type { CanvasConnection } from '../types/canvas-domain-types'
import type { CanvasContextMenuSource } from './context-menu/canvas-context-menu-types'
import type { CanvasDocumentNode } from '../document-contract'
import type { CanvasToolStore } from '../stores/canvas-tool-store'
import type { CanvasToolLocalOverlayStore } from '../stores/canvas-tool-local-overlay-store'

interface UseCanvasToolRuntimeCoreOptions {
  activeTool: CanvasToolId
  canvasEngine: ReturnType<typeof createCanvasEngine>
  canEdit: boolean
  commands: ReturnType<typeof useCanvasDocumentCommands>
  contextMenuSource?: CanvasContextMenuSource
  documentWriter: ReturnType<typeof createCanvasDocumentWriter>
  modifiers: ReturnType<typeof useCanvasModifierKeys>
  pointerRouter: ReturnType<typeof useCanvasPointerRouterController>
  selection: ReturnType<typeof useCanvasSelectionController>
  session: ReturnType<typeof useCanvasSessionState>
  localOverlayStore: CanvasToolLocalOverlayStore
  toolStore: CanvasToolStore
  viewportController: ReturnType<typeof createCanvasViewportController>
}

export function useCanvasToolRuntimeCore({
  activeTool,
  canvasEngine,
  canEdit,
  commands,
  contextMenuSource,
  documentWriter,
  modifiers,
  pointerRouter,
  selection,
  session,
  localOverlayStore,
  toolStore,
  viewportController,
}: UseCanvasToolRuntimeCoreOptions) {
  const interaction = pointerRouter.interaction
  const cursorPresence = useCanvasCursorPresence({
    screenToCanvasPosition: viewportController.screenToCanvasPosition,
    awareness: session.awareness.core,
  })
  const activeToolSpec = canvasToolSpecs[activeTool]
  const toolRuntime = createCanvasToolRuntime({
    awareness: session.awareness,
    canvasEngine,
    documentWriter,
    editSession: session.editSession,
    interaction,
    modifiers,
    selection,
    localOverlayStore,
    toolStore,
    viewportController,
  })
  const activeToolHandlers = activeToolSpec.createHandlers(toolRuntime)
  const createContextMenuNode = (node: CanvasDocumentNode) => {
    if (!canEdit) {
      return
    }
    documentWriter.createNode(node)
  }
  const contextMenu = useCanvasContextMenu({
    activeTool,
    canEdit,
    canvasEngine,
    source: contextMenuSource,
    createNode: createContextMenuNode,
    setPendingEditNodeId: session.editSession.setPendingEditNodeId,
    setPendingEditNodePoint: session.editSession.setPendingEditNodePoint,
    screenToCanvasPosition: viewportController.screenToCanvasPosition,
    selection,
    commands,
  })
  const createEdgeFromConnection = (connection: CanvasConnection) => {
    if (!canEdit || activeTool !== 'edge') return
    documentWriter.createEdge(connection, getEdgeCreationDefaults(toolStore))
  }

  return {
    activeToolHandlers,
    activeToolSpec,
    contextMenu,
    cursorPresence,
    createEdgeFromConnection,
  }
}
