import type { ResourceId } from '../../resources/domain-id'
import type * as Y from 'yjs'
import { useEffect, useLayoutEffect, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useCanvasDocumentProjection } from './document/use-canvas-document-projection'
import { useCanvasModifierKeys } from './interaction/use-canvas-modifier-keys'
import { useCanvasPointerRouterController } from './interaction/use-canvas-pointer-router'
import { useCanvasSessionState } from './session/use-canvas-session-state'
import { useCanvasCoreRuntime } from './use-canvas-core-runtime'
import { useCanvasEffectiveTool } from './use-canvas-effective-tool'
import { useCanvasDocumentRuntime } from './use-canvas-document-runtime'
import {
  useCanvasInteractionRuntime,
  useCanvasSelectionRuntime,
} from './use-canvas-interaction-runtime'
import { useCanvasToolRuntimeCore } from './use-canvas-tool-runtime-core'
import { createCanvasToolLocalOverlayStore } from '../stores/canvas-tool-local-overlay-store'
import { createCanvasToolStore } from '../stores/canvas-tool-store'
import type { CanvasViewport } from '../types/canvas-domain-types'
import type { CanvasContextMenuSource } from './context-menu/canvas-context-menu-types'
import type { CanvasCollaborationProvider } from '../session-contract'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../document-contract'

import type { CanvasViewportStore } from './interaction/canvas-viewport-storage'

interface UseCanvasEditorRuntimeCoreOptions {
  nodesMap: Y.Map<CanvasDocumentNode>
  edgesMap: Y.Map<CanvasDocumentEdge>
  canvasId: ResourceId
  canEdit: boolean
  contextMenuSource?: CanvasContextMenuSource
  provider: CanvasCollaborationProvider | null
  doc: Y.Doc
  initialViewport: CanvasViewport
  viewportStore: CanvasViewportStore
}

export function useCanvasEditorRuntimeCore({
  nodesMap,
  edgesMap,
  canvasId,
  canEdit,
  contextMenuSource,
  provider,
  doc,
  initialViewport,
  viewportStore,
}: UseCanvasEditorRuntimeCoreOptions) {
  const session = useCanvasSessionState({ provider })
  const [toolStore] = useState(() => createCanvasToolStore())
  const [localOverlayStore] = useState(() => createCanvasToolLocalOverlayStore())
  useEffect(() => {
    return () => {
      toolStore.getState().reset()
      localOverlayStore.getState().reset()
    }
  }, [canvasId, localOverlayStore, toolStore])

  const core = useCanvasCoreRuntime({
    canvasId,
    initialViewport,
    viewportStore,
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
    toolStore,
  })

  useLayoutEffect(() => {
    historySelectionChangeRef.current = document.history.onSelectionChange
    return () => {
      historySelectionChangeRef.current = () => undefined
    }
  }, [document.history.onSelectionChange, historySelectionChangeRef])

  const activeTool = useCanvasEffectiveTool(toolStore, canEdit)
  const modifiers = useCanvasModifierKeys()
  const pointerRouter = useCanvasPointerRouterController()

  const tools = useCanvasToolRuntimeCore({
    activeTool,
    canvasEngine: core.canvasEngine,
    canEdit,
    commands: document.commands,
    contextMenuSource,
    documentWriter: document.documentWriter,
    modifiers,
    pointerRouter,
    selection,
    session,
    localOverlayStore,
    toolStore,
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
    provider,
    selection,
    session,
    localOverlayStore,
    toolStore,
    viewportController: core.viewportController,
  })
  useCanvasDocumentProjection({
    canvasEngine: core.canvasEngine,
    nodesMap,
    edgesMap,
    localDraggingIdsRef: interaction.localDraggingIdsRef,
    remoteResizeDimensions: session.remoteResizeDimensions,
  })
  const canUsePointerTool = activeTool === 'select'
  const sceneHandlers = {
    activeToolHandlers: tools.activeToolHandlers,
    cursorPresence: tools.cursorPresence,
    createEdgeFromConnection: tools.createEdgeFromConnection,
    onNodeClick: (event: ReactMouseEvent, node: CanvasDocumentNode) => {
      if (!canUsePointerTool) return
      tools.activeToolHandlers.onNodeClick?.(event, node)
    },
    onEdgeClick: (event: ReactMouseEvent, edge: CanvasDocumentEdge) => {
      if (!canUsePointerTool) return
      tools.activeToolHandlers.onEdgeClick?.(event, edge)
    },
    onMouseMove: tools.cursorPresence.onMouseMove,
    onMouseLeave: tools.cursorPresence.onMouseLeave,
  }

  return {
    activeTool,
    canvasEngine: core.canvasEngine,
    canvasSurfaceRef: core.canvasSurfaceRef,
    commands: document.commands,
    contextMenu: tools.contextMenu,
    documentWriter: document.documentWriter,
    domRuntime: core.domRuntime,
    editSession: session.editSession,
    sceneHandlers,
    history: document.history,
    nodeActions: document.nodeActions,
    viewportController: core.viewportController,
    remoteNodeHighlights: session.remoteNodeHighlights,
    remoteEdgeHighlights: session.remoteEdgeHighlights,
    remoteUsers: session.remoteUsers,
    selection,
    localOverlayStore,
    toolStore,
    toolCursor: tools.activeToolSpec.cursor,
  }
}
