import type { ResourceId } from '../../resources/domain-id'
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
import type { CanvasToolLocalOverlayStore } from '../stores/canvas-tool-local-overlay-store'
import type { CanvasToolStore } from '../stores/canvas-tool-store'
import type { createCanvasEngine } from '../system/canvas-engine'
import type { createCanvasViewportController } from '../system/canvas-viewport-controller'
import { canvasToolSpecs } from '../tools/canvas-tool-modules'
import type { CanvasToolHandlers, CanvasToolId } from '../tools/canvas-tool-types'
import type { CanvasSelectionSnapshot } from '../system/canvas-selection'
import type { CanvasCollaborationProvider } from '../session-contract'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../document-contract'

const SELECTION_INCOMPATIBLE_TOOLS = new Set<CanvasToolId>(['draw', 'erase', 'text', 'edge'])

function assertNever(value: never): never {
  throw new Error(`Unhandled canvas tool: ${String(value)}`)
}

interface UseCanvasSelectionRuntimeOptions {
  canvasEngine: ReturnType<typeof createCanvasEngine>
  canvasId: ResourceId
  setLocalSelection: (selection: CanvasSelectionSnapshot | null) => void
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
  const selectionRef = useRef(selection)
  selectionRef.current = selection

  useEffect(() => {
    return () => {
      selectionRef.current.clearSelection()
    }
  }, [canvasId])

  return {
    historySelectionChangeRef,
    selection,
  }
}

interface UseCanvasInteractionRuntimeOptions {
  activeTool: CanvasToolId
  activeToolHandlers: CanvasToolHandlers
  canvasEngine: ReturnType<typeof createCanvasEngine>
  canvasId: ResourceId
  canvasSurfaceRef: RefObject<HTMLDivElement | null>
  canEdit: boolean
  doc: Y.Doc
  documentWriter: ReturnType<typeof createCanvasDocumentWriter>
  edgesMap: Y.Map<CanvasDocumentEdge>
  modifiers: ReturnType<typeof useCanvasModifierKeys>
  nodesMap: Y.Map<CanvasDocumentNode>
  pointerRouter: ReturnType<typeof useCanvasPointerRouterController>
  provider: CanvasCollaborationProvider | null
  selection: ReturnType<typeof useCanvasSelectionController>
  session: ReturnType<typeof useCanvasSessionState>
  localOverlayStore: CanvasToolLocalOverlayStore
  toolStore: CanvasToolStore
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
  provider,
  selection,
  session,
  localOverlayStore,
  toolStore,
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
    getCanStartDrag: () => nodesMap.doc !== null && canEdit && activeTool === 'select',
  })
  const canUsePointerTool = activeTool === 'select'

  useCanvasPerformanceProbeRuntime({
    canvasId,
    canvasEngine,
    canEdit,
    documentWriter,
    doc,
    dragController: dragHandlers,
    edgesMap,
    nodesMap,
    provider,
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
      clearLocalOverlayForTool(localOverlayStore, activeTool)
      const activeToolSpec = canvasToolSpecs[activeTool]
      activeToolSpec.awareness?.clear?.(session.awareness.presence)
    }
  }, [activeTool, localOverlayStore, session.awareness.presence])

  useCanvasPointerRouter({
    router: pointerRouter,
    surfaceRef: canvasSurfaceRef,
    options: {
      activeTool,
      activeToolHandlers,
      awareness: session.awareness.presence,
      canvasEngine,
      enabled: canEdit || canUsePointerTool,
      getShiftPressed: () => modifiers.shiftPressed,
      localOverlay: localOverlayStore.getState(),
      nodeDragController: canEdit ? dragHandlers : null,
      selection,
      setActiveTool: (tool) => toolStore.getState().setActiveTool(tool),
      viewportController,
    },
  })

  useCanvasViewportInteractions({
    ref: canvasSurfaceRef,
    viewportController,
    canPrimaryPan: () => activeTool === 'hand',
  })

  return {
    localDraggingIdsRef,
  }
}

function clearLocalOverlayForTool(
  localOverlayStore: CanvasToolLocalOverlayStore,
  activeTool: CanvasToolId,
) {
  const localOverlay = localOverlayStore.getState()

  switch (activeTool) {
    case 'draw':
      localOverlay.clearDraw()
      return
    case 'erase':
      localOverlay.clearErase()
      return
    case 'lasso':
      localOverlay.clearLasso()
      return
    case 'text':
      localOverlay.clearRectCreation()
      return
    case 'select':
      localOverlay.clearSelect()
      return
    case 'edge':
    case 'hand':
      return
    default:
      assertNever(activeTool)
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
    editSession.setPendingEdit(null)
  }, [activeTool, canEdit, editSession, selection])
}
