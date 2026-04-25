import type { Id } from 'convex/_generated/dataModel'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { Connection, Edge, Node } from '@xyflow/react'
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
import { useCanvasPointerBridge } from './interaction/use-canvas-pointer-bridge'
import { useCanvasRemoteDragAnimation } from './interaction/use-canvas-remote-drag-animation'
import { useCanvasViewportInteractions } from './interaction/use-canvas-viewport-interactions'
import { createCanvasViewportPersistence } from './interaction/canvas-viewport-persistence'
import { useCanvasSurfaceClickGuard } from './interaction/use-canvas-surface-click-guard'
import { exposeCanvasPerformanceRuntime } from './performance/canvas-performance-metrics'
import { useCanvasSelectionController } from './selection/use-canvas-selection-actions'
import { useCanvasSelectionRect } from './selection/use-canvas-selection-rect'
import { useCanvasSessionState } from './session/use-canvas-session-state'
import { createCanvasNodePlacement } from '../nodes/canvas-node-modules'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import { createCanvasEngine } from '../system/canvas-engine'
import { createCanvasViewportController } from '../system/canvas-viewport-controller'
import { canvasToolSpecs } from '../tools/canvas-tool-modules'
import { isPrimarySelectionModifier } from '../utils/canvas-selection-utils'
import { getStrokeBounds } from '../nodes/stroke/stroke-node-model'
import { clearAllStrokePathCache } from '../nodes/stroke/stroke-path-cache'
import type {
  CanvasEdgeCreationDefaults,
  CanvasSelectionSnapshot,
  CanvasToolId,
  CanvasToolRuntime,
} from '../tools/canvas-tool-types'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'
import { useYjsPreviewUpload } from '~/features/previews/hooks/use-yjs-preview-upload'

interface UseCanvasFlowRuntimeOptions {
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  canvasId: Id<'sidebarItems'>
  campaignId: Id<'campaigns'>
  canvasParentId: Id<'sidebarItems'> | null
  canEdit: boolean
  provider: ConvexYjsProvider | null
  doc: Y.Doc
  initialViewport: { x: number; y: number; zoom: number }
}

const SELECTION_INCOMPATIBLE_TOOLS = new Set<CanvasToolId>(['draw', 'erase', 'text', 'edge'])
const PERFORMANCE_STROKE_WIDTH = 160
const PERFORMANCE_STROKE_AMPLITUDE = 28

export function useCanvasFlowRuntime({
  nodesMap,
  edgesMap,
  canvasId,
  campaignId,
  canvasParentId,
  canEdit,
  provider,
  doc,
  initialViewport,
}: UseCanvasFlowRuntimeOptions) {
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

  const cancelConnectionDraft = useCallback(() => {
    // Connection drafts are owned by the internal scene. This hook remains the keyboard/tool
    // integration point for cancelling tool-owned ephemeral state.
  }, [])

  useEffect(() => {
    const previousTool = previousActiveToolRef.current
    previousActiveToolRef.current = activeTool

    if (previousTool === null || previousTool === activeTool) {
      return
    }

    cancelConnectionDraft()

    if (!canEdit || !SELECTION_INCOMPATIBLE_TOOLS.has(activeTool)) {
      return
    }

    selection.clearSelection()
    session.editSession.setEditingEmbedId(null)
    session.editSession.setPendingEditNodeId(null)
    session.editSession.setPendingEditNodePoint(null)
  }, [activeTool, canEdit, cancelConnectionDraft, selection, session.editSession])

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
  const interaction = useCanvasSurfaceClickGuard(canvasSurfaceRef)

  const dragHandlers = useCanvasNodeDragHandlers({
    canvasEngine,
    documentWriter,
    nodesDoc: doc,
    remoteDragAnimation,
    awareness: session.awareness.core,
    interaction,
    getFlowPosition: viewportController.screenToCanvasPosition,
    getZoom: viewportController.getZoom,
    selection,
    localDraggingIdsRef,
    getShiftPressed: () => readShiftModifier(modifiers),
    getPrimaryPressed: () => readPrimaryModifier(modifiers),
    getCanStartDrag: () => useCanvasToolStore.getState().activeTool === 'select',
  })

  useEffect(
    () =>
      exposeCanvasPerformanceRuntime({
        clearCanvas: () => {
          doc.transact(() => {
            nodesMap.clear()
            edgesMap.clear()
          })
          clearAllStrokePathCache()
          selection.clearSelection()
        },
        getCounts: () => ({
          nodes: nodesMap.size,
          edges: edgesMap.size,
        }),
        seedTextNodes: ({
          count,
          columns = 25,
          spacingX = 180,
          spacingY = 120,
          start = { x: 0, y: 0 },
        }) => {
          doc.transact(() => {
            for (let index = 0; index < count; index += 1) {
              const column = index % columns
              const row = Math.floor(index / columns)
              const placement = createCanvasNodePlacement('text', {
                position: {
                  x: start.x + column * spacingX,
                  y: start.y + row * spacingY,
                },
              })
              const node = {
                ...placement.node,
                id: `perf-node-${index}`,
                draggable: false,
                selected: false,
                zIndex: index,
              }
              nodesMap.set(node.id, node)
            }
          })
        },
        seedStrokeNodes: ({
          count,
          columns = 10,
          spacingX = 240,
          spacingY = 160,
          start = { x: 0, y: 0 },
          pointsPerStroke = 80,
        }) => {
          doc.transact(() => {
            for (let index = 0; index < count; index += 1) {
              const column = index % columns
              const row = Math.floor(index / columns)
              const origin = {
                x: start.x + column * spacingX,
                y: start.y + row * spacingY,
              }
              const points = createPerformanceStrokePoints(origin, pointsPerStroke)
              const size = 8
              const bounds = getStrokeBounds(points, size)
              nodesMap.set(`perf-stroke-${index}`, {
                id: `perf-stroke-${index}`,
                type: 'stroke',
                position: { x: bounds.x, y: bounds.y },
                width: bounds.width,
                height: bounds.height,
                data: {
                  points,
                  color: '#2563eb',
                  size,
                  opacity: 100,
                  bounds,
                },
                draggable: false,
                selected: false,
                zIndex: index,
              })
            }
          })
        },
        updateSelectedNodeSurface: () => {
          const updates = new Map<string, Record<string, unknown>>()
          for (const nodeId of selection.getSnapshot().nodeIds) {
            updates.set(nodeId, {
              backgroundColor: '#e8f2ff',
              borderStroke: '#2563eb',
            })
          }
          documentWriter.patchNodeData(updates)
        },
        selectFirstNodes: (count) => {
          const nodeIds = new Set<string>()
          for (let index = 0; index < count; index += 1) {
            nodeIds.add(`perf-node-${index}`)
          }
          selection.setSelection({ nodeIds, edgeIds: new Set() })
        },
        getSelectedCount: () =>
          selection.getSnapshot().nodeIds.size + selection.getSnapshot().edgeIds.size,
        profileSelectedNodeDrag: ({ delta, steps }) => {
          const selectedIds = selection.getSnapshot().nodeIds
          dragHandlers.profileDrag({ nodeIds: selectedIds, delta, steps })
        },
        getNodePosition: (nodeId) =>
          canvasEngine.getSnapshot().nodeLookup.get(nodeId)?.node.position ?? null,
        setViewport: (viewport) => {
          viewportController.syncFromDocumentOrAdapter(viewport)
        },
        getViewport: () => viewportController.getViewport(),
      }),
    [
      canvasEngine,
      doc,
      documentWriter,
      dragHandlers,
      edgesMap,
      nodesMap,
      selection,
      viewportController,
    ],
  )

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
    cancelConnectionDraft,
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

  const isSelectMode = activeTool === 'select'
  const isEdgeMode = activeTool === 'edge'

  useCanvasSelectionRect({
    canvasEngine,
    viewportController,
    surfaceRef: canvasSurfaceRef,
    awareness: session.awareness.presence,
    selection,
    interaction,
    enabled: canEdit && isSelectMode,
  })

  const toolRuntime: CanvasToolRuntime = {
    viewport: {
      screenToFlowPosition: viewportController.screenToCanvasPosition,
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

  useCanvasPointerBridge({
    surfaceRef: canvasSurfaceRef,
    activeToolHandlers,
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
    screenToFlowPosition: viewportController.screenToCanvasPosition,
  })

  const getEdgeCreationDefaults = (): CanvasEdgeCreationDefaults => {
    const { edgeType, strokeColor, strokeOpacity, strokeSize } = useCanvasToolStore.getState()

    return {
      type: edgeType,
      style: {
        stroke: strokeColor,
        strokeWidth: strokeSize,
        opacity: strokeOpacity >= 100 ? undefined : strokeOpacity / 100,
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
    screenToFlowPosition: viewportController.screenToCanvasPosition,
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
    dropTarget,
    editSession: session.editSession,
    sceneHandlers: {
      activeToolHandlers,
      cursorPresence,
      createEdgeFromConnection: (connection: Connection) => {
        if (!canEdit || !isEdgeMode) {
          return
        }
        documentWriter.createEdge(connection, getEdgeCreationDefaults())
      },
      onNodeClick: (event: ReactMouseEvent, node: Node) => {
        if (!canEdit || !isSelectMode) {
          return
        }
        activeToolHandlers.onNodeClick?.(event, node)
      },
      onEdgeClick: (event: ReactMouseEvent, edge: Edge) => {
        if (!canEdit || !isSelectMode) {
          return
        }
        activeToolHandlers.onEdgeClick?.(event, edge)
      },
      onPaneClick: (event: ReactMouseEvent) => {
        if (!canEdit || !isSelectMode || isPrimarySelectionModifier(event)) {
          return
        }
        selection.clearSelection()
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

function createPerformanceStrokePoints(
  origin: { x: number; y: number },
  pointsPerStroke: number,
): Array<[number, number, number]> {
  const safePointCount = Math.max(2, Math.floor(pointsPerStroke))
  const points: Array<[number, number, number]> = []

  for (let index = 0; index < safePointCount; index += 1) {
    const progress = index / (safePointCount - 1)
    points.push([
      origin.x + progress * PERFORMANCE_STROKE_WIDTH,
      origin.y + Math.sin(progress * Math.PI * 4) * PERFORMANCE_STROKE_AMPLITUDE,
      0.5,
    ])
  }

  return points
}

function readPrimaryModifier(modifiers: ReturnType<typeof useCanvasModifierKeys>) {
  return modifiers.getPrimaryPressed?.() ?? modifiers.primaryPressed
}

function readShiftModifier(modifiers: ReturnType<typeof useCanvasModifierKeys>) {
  return modifiers.getShiftPressed?.() ?? modifiers.shiftPressed
}
