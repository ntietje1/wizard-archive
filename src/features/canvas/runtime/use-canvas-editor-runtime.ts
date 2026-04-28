import type { Id } from 'convex/_generated/dataModel'
import { useEffect, useMemo, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react'
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
import { useCanvasViewportInteractions } from './interaction/use-canvas-viewport-interactions'
import { createCanvasViewportPersistence } from './interaction/canvas-viewport-persistence'
import {
  useCanvasPointerRouter,
  useCanvasPointerRouterController,
} from './interaction/use-canvas-pointer-router'
import { useCanvasPerformanceProbeRuntime } from './performance/use-canvas-performance-probe-runtime'
import { useCanvasSelectionController } from './selection/use-canvas-selection-actions'
import { useCanvasSessionState } from './session/use-canvas-session-state'
import { clampCanvasEdgeStrokeWidth } from '../edges/shared/canvas-edge-style'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import { createCanvasDomRuntime } from '../system/canvas-dom-runtime'
import { createCanvasEngine } from '../system/canvas-engine'
import { createCanvasViewportController } from '../system/canvas-viewport-controller'
import { canvasToolSpecs } from '../tools/canvas-tool-modules'
import type {
  CanvasEdgeCreationDefaults,
  CanvasSelectionSnapshot,
  CanvasToolHandlers,
  CanvasToolId,
  CanvasToolRuntime,
} from '../tools/canvas-tool-types'
import type {
  CanvasConnection,
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '../types/canvas-domain-types'
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
  const { canvasEngine, canvasSurfaceRef, domRuntime, viewportController } = useCanvasCoreServices({
    canvasId,
    initialViewport,
  })
  const { historySelectionChangeRef, selection } = useCanvasSelectionServices({
    canvasEngine,
    canvasId,
    setLocalSelection: session.awareness.core.setLocalSelection,
  })
  const localDraggingIdsRef = useRef(new Set<string>())

  useYjsPreviewUpload({
    itemId: canvasId,
    doc,
    containerRef: canvasSurfaceRef,
    resolveElement: (container) => container,
  })

  const { commands, documentWriter, history, nodeActions } = useCanvasEditorDocumentServices({
    canEdit,
    canvasEngine,
    edgesMap,
    nodesMap,
    selection,
    session,
  })
  historySelectionChangeRef.current = history.onSelectionChange
  const modifiers = useCanvasModifierKeys()
  const pointerRouter = useCanvasPointerRouterController()
  const interaction = pointerRouter.interaction
  const activeTool = useCanvasToolStore((state) => state.activeTool)

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
  })
  const { activeToolSpec, activeToolHandlers, contextMenu, cursorPresence, dropTarget } =
    useCanvasToolSceneModel({
      activeTool,
      campaignId,
      canvasEngine,
      canvasId,
      canvasParentId,
      canEdit,
      commands,
      documentWriter,
      edgesMap,
      modifiers,
      nodesMap,
      pointerRouter,
      selection,
      session,
      viewportController,
    })
  useCanvasEditorInteractionServices({
    activeTool,
    activeToolHandlers,
    canvasEngine,
    canvasSurfaceRef,
    canEdit,
    dragHandlers,
    modifiers,
    pointerRouter,
    selection,
    session,
    viewportController,
  })
  const isSelectMode = activeTool === 'select'
  const isEdgeMode = activeTool === 'edge'

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
      onNodeClick: (event: ReactMouseEvent, node: CanvasDocumentNode) => {
        if (!canEdit || !isSelectMode) {
          return
        }
        activeToolHandlers.onNodeClick?.(event, node)
      },
      onEdgeClick: (event: ReactMouseEvent, edge: CanvasDocumentEdge) => {
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
    viewportController,
    remoteHighlights: session.remoteHighlights,
    remoteUsers: session.remoteUsers,
    selection,
    toolCursor: activeToolSpec.cursor,
  }
}

function useCanvasCoreServices({
  canvasId,
  initialViewport,
}: Pick<UseCanvasEditorRuntimeOptions, 'canvasId' | 'initialViewport'>) {
  const domRuntimeRef = useRef<ReturnType<typeof createCanvasDomRuntime> | null>(null)
  domRuntimeRef.current ??= createCanvasDomRuntime()
  const domRuntime = domRuntimeRef.current
  const canvasEngineRef = useRef<ReturnType<typeof createCanvasEngine> | null>(null)
  canvasEngineRef.current ??= createCanvasEngine({ domRuntime })
  const canvasEngine = canvasEngineRef.current
  const canvasSurfaceRef = useRef<HTMLDivElement>(null)
  const viewportControllerRef = useRef<ReturnType<typeof createCanvasViewportController> | null>(
    null,
  )
  viewportControllerRef.current ??= createCanvasViewportController({
    canvasEngine,
    domRuntime,
    getSurfaceElement: () => canvasSurfaceRef.current,
  })
  const viewportController = viewportControllerRef.current

  useEffect(() => () => canvasEngine.destroy(), [canvasEngine])
  useEffect(() => () => domRuntime.destroy(), [domRuntime])
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

  return {
    canvasEngine,
    canvasSurfaceRef,
    domRuntime,
    viewportController,
  }
}

function useCanvasSelectionServices({
  canvasEngine,
  canvasId,
  setLocalSelection,
}: {
  canvasEngine: ReturnType<typeof createCanvasEngine>
  canvasId: Id<'sidebarItems'>
  setLocalSelection: (nodeIds: ReadonlySet<string> | null) => void
}) {
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

function useCanvasEditorDocumentServices({
  canEdit,
  canvasEngine,
  edgesMap,
  nodesMap,
  selection,
  session,
}: Pick<UseCanvasEditorRuntimeOptions, 'canEdit' | 'edgesMap' | 'nodesMap'> & {
  canvasEngine: ReturnType<typeof createCanvasEngine>
  selection: ReturnType<typeof useCanvasSelectionController>
  session: ReturnType<typeof useCanvasSessionState>
}) {
  const documentWriter = useMemo(
    () =>
      createCanvasDocumentWriter({
        nodesMap,
        edgesMap,
      }),
    [edgesMap, nodesMap],
  )
  const history = useCanvasHistory({
    nodesMap,
    edgesMap,
    selection,
  })
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

  return {
    commands,
    documentWriter,
    history,
    nodeActions,
  }
}

function useCanvasToolSceneModel({
  activeTool,
  campaignId,
  canvasEngine,
  canvasId,
  canvasParentId,
  canEdit,
  commands,
  documentWriter,
  edgesMap,
  modifiers,
  nodesMap,
  pointerRouter,
  selection,
  session,
  viewportController,
}: Pick<
  UseCanvasEditorRuntimeOptions,
  'campaignId' | 'canvasId' | 'canvasParentId' | 'canEdit' | 'edgesMap' | 'nodesMap'
> & {
  activeTool: CanvasToolId
  canvasEngine: ReturnType<typeof createCanvasEngine>
  commands: ReturnType<typeof useCanvasCommands>
  documentWriter: ReturnType<typeof createCanvasDocumentWriter>
  modifiers: ReturnType<typeof useCanvasModifierKeys>
  pointerRouter: ReturnType<typeof useCanvasPointerRouterController>
  selection: ReturnType<typeof useCanvasSelectionController>
  session: ReturnType<typeof useCanvasSessionState>
  viewportController: ReturnType<typeof createCanvasViewportController>
}) {
  const interaction = pointerRouter.interaction
  const cursorPresence = useCanvasCursorPresence({
    screenToCanvasPosition: viewportController.screenToCanvasPosition,
    awareness: session.awareness.core,
  })
  const isSelectMode = activeTool === 'select'
  const activeToolSpec = canvasToolSpecs[activeTool]
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
  const activeToolHandlers = activeToolSpec.createHandlers(toolRuntime)
  const dropTarget = useCanvasDropIntegration({
    canvasId,
    canEdit,
    isSelectMode,
    createNode: documentWriter.createNode,
    screenToCanvasPosition: viewportController.screenToCanvasPosition,
  })
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
    activeToolHandlers,
    activeToolSpec,
    contextMenu,
    cursorPresence,
    dropTarget,
  }
}

function useCanvasEditorInteractionServices({
  activeTool,
  activeToolHandlers,
  canvasEngine,
  canvasSurfaceRef,
  canEdit,
  dragHandlers,
  modifiers,
  pointerRouter,
  selection,
  session,
  viewportController,
}: Pick<UseCanvasEditorRuntimeOptions, 'canEdit'> & {
  activeTool: CanvasToolId
  activeToolHandlers: CanvasToolHandlers
  canvasEngine: ReturnType<typeof createCanvasEngine>
  canvasSurfaceRef: RefObject<HTMLDivElement | null>
  dragHandlers: ReturnType<typeof useCanvasNodeDragHandlers>
  modifiers: ReturnType<typeof useCanvasModifierKeys>
  pointerRouter: ReturnType<typeof useCanvasPointerRouterController>
  selection: ReturnType<typeof useCanvasSelectionController>
  session: ReturnType<typeof useCanvasSessionState>
  viewportController: ReturnType<typeof createCanvasViewportController>
}) {
  const previousActiveToolRef = useRef<CanvasToolId | null>(null)

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
}

function getEdgeCreationDefaults(): CanvasEdgeCreationDefaults {
  const { edgeType, strokeColor, strokeOpacity, strokeSize } = useCanvasToolStore.getState()

  return {
    type: edgeType,
    style: {
      stroke: strokeColor,
      strokeWidth: clampCanvasEdgeStrokeWidth(strokeSize),
      opacity: normalizeOpacityPercent(strokeOpacity),
    },
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
