import type { Id } from 'convex/_generated/dataModel'
import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type * as Y from 'yjs'
import type { createCanvasDocumentWriter } from './document/use-canvas-document-writer'
import type { useCanvasModifierKeys } from './interaction/use-canvas-modifier-keys'
import { useCanvasNodeDragHandlers } from './interaction/use-canvas-node-drag-handlers'
import { useCanvasViewportInteractions } from './interaction/use-canvas-viewport-interactions'
import type { useCanvasPointerRouterController } from './interaction/use-canvas-pointer-router'
import { useCanvasPointerRouter } from './interaction/use-canvas-pointer-router'
import { useCanvasPerformanceProbeRuntime } from './performance/use-canvas-performance-probe-runtime'
import { useCanvasSelectionController } from './selection/use-canvas-selection-actions'
import type { useCanvasSessionState } from './session/use-canvas-session-state'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import type { createCanvasEngine } from '../system/canvas-engine'
import type { createCanvasViewportController } from '../system/canvas-viewport-controller'
import { canvasToolSpecs } from '../tools/canvas-tool-modules'
import type { CanvasToolHandlers, CanvasToolId } from '../tools/canvas-tool-types'
import type { CanvasSelectionSnapshot } from '../system/canvas-selection'
import type { CanvasDocumentEdge, CanvasDocumentNode } from 'convex/canvases/validation'

const SELECTION_INCOMPATIBLE_TOOLS = new Set<CanvasToolId>(['draw', 'erase', 'text', 'edge'])

interface UseCanvasSelectionRuntimeOptions {
  canvasEngine: ReturnType<typeof createCanvasEngine>
  canvasId: Id<'sidebarItems'>
  setLocalSelection: (nodeIds: ReadonlySet<string> | null) => void
}

export function useCanvasSelectionRuntime({
  canvasEngine,
  canvasId,
  setLocalSelection,
}: UseCanvasSelectionRuntimeOptions) {
  const historySelectionChangeRef = useRef<(selection: CanvasSelectionSnapshot) => void>(
    () => undefined,
  )
  const selection = useCanvasSelectionController({
    canvasEngine,
    onSelectionChange: (nextSelection) => {
      historySelectionChangeRef.current(nextSelection)
    },
    setLocalSelection,
  })

  useEffect(() => {
    return () => {
      canvasEngine.clearSelection()
    }
  }, [canvasEngine, canvasId])

  return {
    historySelectionChangeRef,
    selection,
  }
}

interface UseCanvasInteractionRuntimeOptions {
  activeTool: CanvasToolId
  activeToolHandlers: CanvasToolHandlers
  canvasEngine: ReturnType<typeof createCanvasEngine>
  canvasId: Id<'sidebarItems'>
  canvasSurfaceRef: RefObject<HTMLDivElement | null>
  canEdit: boolean
  doc: Y.Doc
  documentWriter: ReturnType<typeof createCanvasDocumentWriter>
  edgesMap: Y.Map<CanvasDocumentEdge>
  modifiers: ReturnType<typeof useCanvasModifierKeys>
  nodesMap: Y.Map<CanvasDocumentNode>
  pointerRouter: ReturnType<typeof useCanvasPointerRouterController>
  selection: ReturnType<typeof useCanvasSelectionController>
  session: ReturnType<typeof useCanvasSessionState>
  viewportController: ReturnType<typeof createCanvasViewportController>
}

export function useCanvasInteractionRuntime({
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
}: UseCanvasInteractionRuntimeOptions) {
  const localDraggingIdsRef = useRef(new Set<string>())
  const interaction = pointerRouter.interaction
  const dragHandlers = useCanvasNodeDragHandlers({
    canvasEngine,
    documentWriter,
    nodesDoc: doc,
    awareness: session.awareness.core,
    interaction,
    getCanvasPosition: viewportController.screenToCanvasPosition,
    getZoom: viewportController.getZoom,
    selection,
    localDraggingIdsRef,
    getShiftPressed: () => modifiers.shiftPressed,
    getPrimaryPressed: () => modifiers.primaryPressed,
    getCanStartDrag: () => useCanvasToolStore.getState().activeTool === 'select',
  })

  useCanvasPerformanceProbeRuntime({
    canvasId,
    canvasEngine,
    documentWriter,
    doc,
    dragController: dragHandlers,
    edgesMap,
    nodesMap,
    selection,
    viewportController,
  })
  useCanvasSelectionIncompatibleToolCleanup({
    activeTool,
    canEdit,
    selection,
    editSession: session.editSession,
  })

  useEffect(() => {
    return () => {
      const activeToolSpec = canvasToolSpecs[activeTool]
      activeToolSpec.localOverlay?.clear()
      activeToolSpec.awareness?.clear?.(session.awareness.presence)
    }
  }, [activeTool, session.awareness.presence])

  useCanvasPointerRouter({
    router: pointerRouter,
    surfaceRef: canvasSurfaceRef,
    options: {
      activeTool,
      activeToolHandlers,
      awareness: session.awareness.presence,
      canvasEngine,
      enabled: canEdit,
      getShiftPressed: () => modifiers.shiftPressed,
      nodeDragController: dragHandlers,
      selection,
      viewportController,
    },
  })

  useCanvasViewportInteractions({
    ref: canvasSurfaceRef,
    viewportController,
    canPrimaryPan: () => useCanvasToolStore.getState().activeTool === 'hand',
  })

  return {
    localDraggingIdsRef,
  }
}

function useCanvasSelectionIncompatibleToolCleanup({
  activeTool,
  canEdit,
  selection,
  editSession,
}: {
  activeTool: CanvasToolId
  canEdit: boolean
  selection: ReturnType<typeof useCanvasSelectionController>
  editSession: ReturnType<typeof useCanvasSessionState>['editSession']
}) {
  const previousActiveToolRef = useRef<CanvasToolId | null>(null)

  useEffect(() => {
    const previousTool = previousActiveToolRef.current
    previousActiveToolRef.current = activeTool

    if (previousTool === null || previousTool === activeTool) {
      return
    }

    if (!canEdit || !SELECTION_INCOMPATIBLE_TOOLS.has(activeTool)) {
      return
    }

    selection.clearSelection()
    editSession.setEditingEmbedId(null)
    editSession.setPendingEditNodeId(null)
    editSession.setPendingEditNodePoint(null)
  }, [activeTool, canEdit, editSession, selection])
}
