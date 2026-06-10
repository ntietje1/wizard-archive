import type { Id } from 'convex/_generated/dataModel'
import { useCallback, useMemo } from 'react'
import type { createCanvasDocumentWriter } from './document/use-canvas-document-writer'
import type { useCanvasDocumentCommands } from './document/use-canvas-commands'
import { createCanvasToolRuntime, getEdgeCreationDefaults } from './canvas-tool-runtime-adapter'
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

interface UseCanvasToolRuntimeCoreOptions {
  activeTool: CanvasToolId
  campaignId?: Id<'campaigns'>
  canvasEngine: ReturnType<typeof createCanvasEngine>
  canvasParentId: Id<'sidebarItems'> | null
  canEdit: boolean
  commands: ReturnType<typeof useCanvasDocumentCommands>
  documentWriter: ReturnType<typeof createCanvasDocumentWriter>
  modifiers: ReturnType<typeof useCanvasModifierKeys>
  pointerRouter: ReturnType<typeof useCanvasPointerRouterController>
  selection: ReturnType<typeof useCanvasSelectionController>
  session: ReturnType<typeof useCanvasSessionState>
  viewportController: ReturnType<typeof createCanvasViewportController>
}

export function useCanvasToolRuntimeCore({
  activeTool,
  campaignId,
  canvasEngine,
  canvasParentId,
  canEdit,
  commands,
  documentWriter,
  modifiers,
  pointerRouter,
  selection,
  session,
  viewportController,
}: UseCanvasToolRuntimeCoreOptions) {
  const interaction = pointerRouter.interaction
  const cursorPresence = useCanvasCursorPresence({
    screenToCanvasPosition: viewportController.screenToCanvasPosition,
    awareness: session.awareness.core,
  })
  const activeToolSpec = canvasToolSpecs[activeTool]
  const toolRuntime = useMemo(
    () =>
      createCanvasToolRuntime({
        awareness: session.awareness,
        canvasEngine,
        documentWriter,
        editSession: session.editSession,
        interaction,
        modifiers,
        selection,
        viewportController,
      }),
    [
      canvasEngine,
      documentWriter,
      interaction,
      modifiers,
      selection,
      session.awareness,
      session.editSession,
      viewportController,
    ],
  )
  const activeToolHandlers = useMemo(
    () => activeToolSpec.createHandlers(toolRuntime),
    [activeToolSpec, toolRuntime],
  )
  const contextMenu = useCanvasContextMenu({
    activeTool,
    canEdit,
    campaignId,
    canvasParentId,
    canvasEngine,
    createNode: documentWriter.createNode,
    setPendingEditNodeId: session.editSession.setPendingEditNodeId,
    setPendingEditNodePoint: session.editSession.setPendingEditNodePoint,
    screenToCanvasPosition: viewportController.screenToCanvasPosition,
    selection,
    commands,
  })
  const createEdgeFromConnection = useCallback(
    (connection: CanvasConnection) => {
      if (!canEdit || activeTool !== 'edge') return
      documentWriter.createEdge(connection, getEdgeCreationDefaults())
    },
    [activeTool, canEdit, documentWriter],
  )

  return {
    activeToolHandlers,
    activeToolSpec,
    contextMenu,
    cursorPresence,
    createEdgeFromConnection,
  }
}
