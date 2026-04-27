import type { Id } from 'convex/_generated/dataModel'
import { useEffect, useMemo, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type * as Y from 'yjs'
import { getMeasuredCanvasNodesFromEngineSnapshot } from './document/canvas-measured-nodes'
import { useCanvasCommands } from './document/use-canvas-commands'
import { useCanvasDocumentProjection } from './document/use-canvas-document-projection'
import { createCanvasDocumentWriter } from './document/use-canvas-document-writer'
import { useCanvasHistory } from './document/use-canvas-history'
import { useCanvasKeyboardShortcuts } from './document/use-canvas-keyboard-shortcuts'
import { useCanvasContextMenu } from './context-menu/use-canvas-context-menu'
import { transactCanvasMaps } from './document/canvas-yjs-transactions'
import { useCanvasCursorPresence } from './interaction/use-canvas-cursor-presence'
import { useCanvasDropIntegration } from './interaction/use-canvas-drop-integration'
import { useCanvasModifierKeys } from './interaction/use-canvas-modifier-keys'
import { createCanvasNodeActions } from './interaction/create-canvas-node-actions'
import { useCanvasNodeDragHandlers } from './interaction/use-canvas-node-drag-handlers'
import { useCanvasRemoteDragAnimation } from './interaction/use-canvas-remote-drag-animation'
import { useCanvasViewportInteractions } from './interaction/use-canvas-viewport-interactions'
import { createCanvasViewportPersistence } from './interaction/canvas-viewport-persistence'
import {
  useCanvasPointerRouter,
  useCanvasPointerRouterController,
} from './interaction/use-canvas-pointer-router'
import { useCanvasPerformanceProbeRuntime } from './performance/use-canvas-performance-probe-runtime'
import { useCanvasSelectionController } from './selection/use-canvas-selection-actions'
import { useCanvasSessionState } from './session/use-canvas-session-state'
import { createCanvasDomRuntimeAdapter } from './providers/canvas-runtime'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import { createCanvasEngine } from '../system/canvas-engine'
import { createCanvasViewportController } from '../system/canvas-viewport-controller'
import { canvasToolSpecs } from '../tools/canvas-tool-modules'
import type {
  CanvasEdgeCreationDefaults,
  CanvasSelectionSnapshot,
  CanvasToolId,
  CanvasToolRuntime,
} from '../tools/canvas-tool-types'
import type { CanvasConnection, CanvasEdge, CanvasNode } from '../types/canvas-domain-types'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'
import { useYjsPreviewUpload } from '~/features/previews/hooks/use-yjs-preview-upload'

interface UseCanvasEditorRuntimeOptions {
  nodesMap: Y.Map<CanvasNode>
  edgesMap: Y.Map<CanvasEdge>
  canvasId: Id<'sidebarItems'>
  campaignId: Id<'campaigns'>
  canvasParentId: Id<'sidebarItems'> | null
  canEdit: boolean
  provider: ConvexYjsProvider | null
  doc: Y.Doc
  initialViewport: { x: number; y: number; zoom: number }
}

const SELECTION_INCOMPATIBLE_TOOLS = new Set<CanvasToolId>(['draw', 'erase', 'text', 'edge'])
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
  const activeTool = useCanvasToolStore((state) => state.activeTool)
  const canvasEngineRef = useRef<ReturnType<typeof createCanvasEngine> | null>(null)
  canvasEngineRef.current ??= createCanvasEngine()
  const canvasEngine = canvasEngineRef.current
  const canvasSurfaceRef = useRef<HTMLDivElement>(null)
  const viewportControllerRef = useRef<ReturnType<typeof createCanvasViewportController> | null>(
    null,
  )
  viewportControllerRef.current ??= createCanvasViewportController({
    canvasEngine,
    getSurfaceElement: () => canvasSurfaceRef.current,
  })
  const viewportController = viewportControllerRef.current
  const pointerRouter = useCanvasPointerRouterController()
  const localDraggingIdsRef = useRef(new Set<string>())
  const previousActiveToolRef = useRef<CanvasToolId | null>(null)
  const historySelectionChangeRef = useRef<(selection: CanvasSelectionSnapshot) => void>(
    () => undefined,
  )
  const selection = useCanvasSelectionController({
    canvasEngine,
    onSelectionChange: (nextSelection) => {
      historySelectionChangeRef.current(nextSelection)
    },
    setLocalSelection: session.awareness.core.setLocalSelection,
  })
  const remoteDragAnimation = useCanvasRemoteDragAnimation({
    canvasEngine,
    localDraggingIdsRef,
    remoteDragPositions: session.remoteDragPositions,
  })

  useEffect(() => {
    return () => {
      canvasEngine.clearSelection()
    }
  }, [canvasEngine, canvasId])

  useEffect(() => () => canvasEngine.destroy(), [canvasEngine])
  useEffect(() => () => viewportController.destroy(), [viewportController])

  useEffect(() => {
    viewportController.syncFromDocumentOrAdapter({
      x: initialViewport.x,
      y: initialViewport.y,
      zoom: initialViewport.zoom,
    })
  }, [initialViewport.x, initialViewport.y, initialViewport.zoom, viewportController])

  useEffect(
    () =>
      createCanvasViewportPersistence({
        canvasEngine,
        canvasId,
        initialViewport: {
          x: initialViewport.x,
          y: initialViewport.y,
          zoom: initialViewport.zoom,
        },
      }),
    [canvasEngine, canvasId, initialViewport.x, initialViewport.y, initialViewport.zoom],
  )

  useEffect(() => {
    return () => {
      const activeToolSpec = canvasToolSpecs[activeTool]
      activeToolSpec.localOverlay?.clear()
      activeToolSpec.awareness?.clear?.(session.awareness.presence)
    }
  }, [activeTool, session.awareness.presence])

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
    session.editSession.setEditingEmbedId(null)
    session.editSession.setPendingEditNodeId(null)
    session.editSession.setPendingEditNodePoint(null)
  }, [activeTool, canEdit, selection, session.editSession])

  useYjsPreviewUpload({
    itemId: canvasId,
    doc,
    containerRef: canvasSurfaceRef,
    resolveElement: (container) => container,
  })

  const documentWriter = useMemo(
    () =>
      createCanvasDocumentWriter({
        nodesMap,
        edgesMap,
      }),
    [edgesMap, nodesMap],
  )
  const modifiers = useCanvasModifierKeys()
  const interaction = pointerRouter.interaction

  const dragHandlers = useCanvasNodeDragHandlers({
    canvasEngine,
    documentWriter,
    nodesDoc: doc,
    remoteDragAnimation,
    awareness: session.awareness.core,
    interaction,
    getCanvasPosition: viewportController.screenToCanvasPosition,
    getZoom: viewportController.getZoom,
    selection,
    localDraggingIdsRef,
    getShiftPressed: () => readShiftModifier(modifiers),
    getPrimaryPressed: () => readPrimaryModifier(modifiers),
    getCanStartDrag: () => useCanvasToolStore.getState().activeTool === 'select',
  })

  useCanvasPerformanceProbeRuntime({
    canvasEngine,
    documentWriter,
    doc,
    dragController: dragHandlers,
    edgesMap,
    nodesMap,
    selection,
    viewportController,
  })

  useCanvasDocumentProjection({
    canvasEngine,
    nodesMap,
    edgesMap,
    localDraggingIdsRef,
    remoteResizeDimensions: session.remoteResizeDimensions,
    remoteDragAnimation,
  })

  const history = useCanvasHistory({
    nodesMap,
    edgesMap,
    selection,
  })
  historySelectionChangeRef.current = history.onSelectionChange
  const commands = useCanvasCommands({
    canEdit,
    nodesMap,
    edgesMap,
    selection,
  })

  useCanvasKeyboardShortcuts({
    undo: history.undo,
    redo: history.redo,
    canEdit,
    nodesMap,
    edgesMap,
    selection,
    commands,
  })

  const cursorPresence = useCanvasCursorPresence({
    screenToCanvasPosition: viewportController.screenToCanvasPosition,
    awareness: session.awareness.core,
  })

  const nodeActions = useMemo(
    () =>
      createCanvasNodeActions({
        canvasEngine,
        documentWriter,
        session,
        transact: (fn) => transactCanvasMaps(nodesMap, edgesMap, fn),
      }),
    [canvasEngine, documentWriter, edgesMap, nodesMap, session],
  )
  const domRuntime = useMemo(() => createCanvasDomRuntimeAdapter(canvasEngine), [canvasEngine])

  const isSelectMode = activeTool === 'select'
  const isEdgeMode = activeTool === 'edge'

  const toolRuntime: CanvasToolRuntime = {
    viewport: {
      screenToCanvasPosition: viewportController.screenToCanvasPosition,
      getZoom: viewportController.getZoom,
    },
    commands: documentWriter,
    query: {
      getNodes: () => [...canvasEngine.getSnapshot().nodes],
      getEdges: () => [...canvasEngine.getSnapshot().edges],
      getMeasuredNodes: () => getMeasuredCanvasNodesFromEngineSnapshot(canvasEngine.getSnapshot()),
    },
    selection,
    interaction,
    modifiers: {
      getShiftPressed: () => readShiftModifier(modifiers),
      getPrimaryPressed: () => readPrimaryModifier(modifiers),
    },
    editSession: session.editSession,
    toolState: {
      getSettings: () => ({
        edgeType: useCanvasToolStore.getState().edgeType,
        strokeColor: useCanvasToolStore.getState().strokeColor,
        strokeOpacity: useCanvasToolStore.getState().strokeOpacity,
        strokeSize: useCanvasToolStore.getState().strokeSize,
      }),
      getActiveTool: () => useCanvasToolStore.getState().activeTool,
      setActiveTool: (tool) => useCanvasToolStore.getState().setActiveTool(tool),
      setEdgeType: (type) => useCanvasToolStore.getState().setEdgeType(type),
      setStrokeColor: (color) => useCanvasToolStore.getState().setStrokeColor(color),
      setStrokeSize: (size) => useCanvasToolStore.getState().setStrokeSize(size),
      setStrokeOpacity: (opacity) => useCanvasToolStore.getState().setStrokeOpacity(opacity),
    },
    awareness: session.awareness,
  }
  const activeToolSpec = canvasToolSpecs[activeTool]
  const activeToolHandlers = activeToolSpec.createHandlers(toolRuntime)

  useCanvasPointerRouter({
    router: pointerRouter,
    surfaceRef: canvasSurfaceRef,
    options: {
      activeTool,
      activeToolHandlers,
      awareness: session.awareness.presence,
      canvasEngine,
      enabled: canEdit,
      getShiftPressed: () => readShiftModifier(modifiers),
      selection,
      viewportController,
    },
  })

  useCanvasViewportInteractions({
    ref: canvasSurfaceRef,
    viewportController,
    canPrimaryPan: () => useCanvasToolStore.getState().activeTool === 'hand',
  })

  const dropTarget = useCanvasDropIntegration({
    canvasId,
    canEdit,
    isSelectMode,
    createNode: documentWriter.createNode,
    screenToCanvasPosition: viewportController.screenToCanvasPosition,
  })

  const getEdgeCreationDefaults = (): CanvasEdgeCreationDefaults => {
    const { edgeType, strokeColor, strokeOpacity, strokeSize } = useCanvasToolStore.getState()

    return {
      type: edgeType,
      style: {
        stroke: strokeColor,
        strokeWidth: strokeSize,
        opacity: normalizeOpacityPercent(strokeOpacity),
      },
    }
  }

  const contextMenu = useCanvasContextMenu({
    activeTool,
    canEdit,
    campaignId,
    canvasParentId,
    nodesMap,
    edgesMap,
    createNode: documentWriter.createNode,
    screenToCanvasPosition: viewportController.screenToCanvasPosition,
    selection,
    commands,
  })

  return {
    activeTool,
    canvasEngine,
    canvasSurfaceRef,
    commands,
    contextMenu,
    documentWriter,
    domRuntime,
    dropTarget,
    editSession: session.editSession,
    sceneHandlers: {
      activeToolHandlers,
      cursorPresence,
      createEdgeFromConnection: (connection: CanvasConnection) => {
        if (!canEdit || !isEdgeMode) {
          return
        }
        documentWriter.createEdge(connection, getEdgeCreationDefaults())
      },
      onNodeClick: (event: ReactMouseEvent, node: CanvasNode) => {
        if (!canEdit || !isSelectMode) {
          return
        }
        activeToolHandlers.onNodeClick?.(event, node)
      },
      onEdgeClick: (event: ReactMouseEvent, edge: CanvasEdge) => {
        if (!canEdit || !isSelectMode) {
          return
        }
        activeToolHandlers.onEdgeClick?.(event, edge)
      },
      onMouseMove: cursorPresence.onMouseMove,
      onMouseLeave: cursorPresence.onMouseLeave,
    },
    history,
    nodeActions,
    nodeDragController: dragHandlers,
    viewportController,
    remoteHighlights: session.remoteHighlights,
    remoteUsers: session.remoteUsers,
    selection,
    toolCursor: activeToolSpec.cursor,
  }
}

function readPrimaryModifier(modifiers: ReturnType<typeof useCanvasModifierKeys>) {
  return modifiers.primaryPressed
}

function readShiftModifier(modifiers: ReturnType<typeof useCanvasModifierKeys>) {
  return modifiers.shiftPressed
}

function normalizeOpacityPercent(opacity: number) {
  if (!Number.isFinite(opacity)) {
    return undefined
  }

  const clampedOpacity = Math.max(0, Math.min(100, opacity))
  return clampedOpacity >= 100 ? undefined : clampedOpacity / 100
}
