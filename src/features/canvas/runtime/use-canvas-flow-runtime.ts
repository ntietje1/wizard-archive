import { useReactFlow, useStoreApi } from '@xyflow/react'
import type { Id } from 'convex/_generated/dataModel'
import { useCallback, useEffect, useRef } from 'react'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'
import { getMeasuredCanvasNodesFromLookup } from './document/canvas-measured-nodes'
import { useCanvasCommands } from './document/use-canvas-commands'
import { useCanvasDocumentProjection } from './document/use-canvas-document-projection'
import { createCanvasDocumentWriter } from './document/use-canvas-document-writer'
import { useCanvasHistory } from './document/use-canvas-history'
import { useCanvasKeyboardShortcuts } from './document/use-canvas-keyboard-shortcuts'
import { useCanvasContextMenu } from './context-menu/use-canvas-context-menu'
import { transactCanvasMaps } from './document/canvas-yjs-transactions'
import { useCanvasCursorPresence } from './interaction/use-canvas-cursor-presence'
import { useCanvasDropIntegration } from './interaction/use-canvas-drop-integration'
import { createCanvasFlowHandlers } from './interaction/use-canvas-flow-handlers'
import { useCanvasModifierKeys } from './interaction/use-canvas-modifier-keys'
import { createCanvasNodeActions } from './interaction/create-canvas-node-actions'
import { useCanvasNodeDragHandlers } from './interaction/use-canvas-node-drag-handlers'
import { useCanvasPointerBridge } from './interaction/use-canvas-pointer-bridge'
import { useCanvasRemoteDragAnimation } from './interaction/use-canvas-remote-drag-animation'
import { useCanvasSurfaceClickGuard } from './interaction/use-canvas-surface-click-guard'
import { useCanvasWheel } from './interaction/use-canvas-wheel'
import { exposeCanvasPerformanceRuntime } from './performance/canvas-performance-metrics'
import { clearCanvasSelectionState } from './selection/use-canvas-selection-state'
import { useCanvasSelectionController } from './selection/use-canvas-selection-actions'
import { useCanvasSelectionRect } from './selection/use-canvas-selection-rect'
import { useCanvasSessionState } from './session/use-canvas-session-state'
import { createCanvasNodePlacement } from '../nodes/canvas-node-modules'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import { canvasToolSpecs } from '../tools/canvas-tool-modules'
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
}

const SELECTION_INCOMPATIBLE_TOOLS = new Set<CanvasToolId>(['draw', 'erase', 'text', 'edge'])

export function useCanvasFlowRuntime({
  nodesMap,
  edgesMap,
  canvasId,
  campaignId,
  canvasParentId,
  canEdit,
  provider,
  doc,
}: UseCanvasFlowRuntimeOptions) {
  const session = useCanvasSessionState({ provider })
  const activeTool = useCanvasToolStore((state) => state.activeTool)
  const reactFlow = useReactFlow()
  const storeApi = useStoreApi()
  const canvasSurfaceRef = useRef<HTMLDivElement>(null)
  const localDraggingIdsRef = useRef(new Set<string>())
  const previousActiveToolRef = useRef<CanvasToolId | null>(null)
  const historySelectionChangeRef = useRef<(selection: CanvasSelectionSnapshot) => void>(
    () => undefined,
  )
  const selection = useCanvasSelectionController({
    onSelectionChange: (nextSelection) => historySelectionChangeRef.current(nextSelection),
    setLocalSelection: session.awareness.core.setLocalSelection,
  })
  const remoteDragAnimation = useCanvasRemoteDragAnimation({
    localDraggingIdsRef,
    remoteDragPositions: session.remoteDragPositions,
  })

  useEffect(() => {
    return () => {
      clearCanvasSelectionState()
    }
  }, [canvasId])

  useEffect(() => {
    return () => {
      const activeToolSpec = canvasToolSpecs[activeTool]
      activeToolSpec.localOverlay?.clear()
      activeToolSpec.awareness?.clear?.(session.awareness.presence)
    }
  }, [activeTool, session.awareness.presence])

  const cancelConnectionDraft = useCallback(() => {
    storeApi.getState().cancelConnection?.()
    storeApi.setState({ connectionClickStartHandle: null })
  }, [storeApi])

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

    selection.clear()
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

  const documentWriter = createCanvasDocumentWriter({
    nodesMap,
    edgesMap,
  })

  const dragHandlers = useCanvasNodeDragHandlers({
    documentWriter,
    nodesDoc: doc,
    remoteDragAnimation,
    awareness: session.awareness.core,
    reactFlowInstance: reactFlow,
    localDraggingIdsRef,
  })

  useEffect(
    () =>
      exposeCanvasPerformanceRuntime({
        clearCanvas: () => {
          doc.transact(() => {
            nodesMap.clear()
            edgesMap.clear()
          })
          selection.clear()
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
        updateSelectedNodeSurface: () => {
          const updates = new Map<string, Record<string, unknown>>()
          for (const nodeId of selection.getSelectedNodeIds()) {
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
          selection.replaceNodes(nodeIds)
        },
        profileSelectedNodeDrag: ({ delta, steps }) => {
          const selectedIds = selection.getSelectedNodeIds()
          const draggedNodes = reactFlow.getNodes().filter((node) => selectedIds.has(node.id))
          const [firstDraggedNode] = draggedNodes
          if (!firstDraggedNode || steps <= 0) {
            return
          }

          const start = { x: 100, y: 100 }
          const createDragEvent = (
            type: string,
            clientX: number,
            clientY: number,
          ): Parameters<typeof dragHandlers.onNodeDrag>[0] =>
            new MouseEvent(type, { clientX, clientY }) as unknown as Parameters<
              typeof dragHandlers.onNodeDrag
            >[0]

          dragHandlers.onNodeDragStart(
            createDragEvent('mousemove', start.x, start.y),
            firstDraggedNode,
            draggedNodes,
          )

          for (let step = 1; step <= steps; step += 1) {
            dragHandlers.onNodeDrag(
              createDragEvent(
                'mousemove',
                start.x + (delta.x * step) / steps,
                start.y + (delta.y * step) / steps,
              ),
              firstDraggedNode,
              draggedNodes,
            )
          }

          dragHandlers.onNodeDragStop(
            createDragEvent('mouseup', start.x + delta.x, start.y + delta.y),
            firstDraggedNode,
            draggedNodes,
          )
        },
      }),
    [doc, documentWriter, dragHandlers, edgesMap, nodesMap, reactFlow, selection],
  )

  useCanvasDocumentProjection({
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
    reactFlowInstance: reactFlow,
    awareness: session.awareness.core,
  })

  const nodeActions = createCanvasNodeActions({
    documentWriter,
    reactFlowInstance: reactFlow,
    session,
    transact: (fn) => transactCanvasMaps(nodesMap, edgesMap, fn),
  })

  const interaction = useCanvasSurfaceClickGuard(canvasSurfaceRef)
  const isSelectMode = activeTool === 'select'
  const isEdgeMode = activeTool === 'edge'
  const modifiers = useCanvasModifierKeys()

  useCanvasSelectionRect({
    surfaceRef: canvasSurfaceRef,
    awareness: session.awareness.presence,
    selection,
    interaction,
    enabled: canEdit && isSelectMode,
  })

  const toolRuntime: CanvasToolRuntime = {
    viewport: {
      screenToFlowPosition: reactFlow.screenToFlowPosition,
      getZoom: () => reactFlow.getZoom(),
    },
    commands: documentWriter,
    query: {
      getNodes: reactFlow.getNodes,
      getEdges: reactFlow.getEdges,
      getMeasuredNodes: () => getMeasuredCanvasNodesFromLookup(storeApi.getState().nodeLookup),
    },
    selection,
    interaction,
    modifiers: {
      getShiftPressed: () => modifiers.shiftPressed,
      getPrimaryPressed: () => modifiers.primaryPressed,
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

  useCanvasWheel(canvasSurfaceRef)

  const dropTarget = useCanvasDropIntegration({
    canvasId,
    canEdit,
    isSelectMode,
    createNode: documentWriter.createNode,
    screenToFlowPosition: reactFlow.screenToFlowPosition,
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

  const flowHandlers = createCanvasFlowHandlers({
    activeToolHandlers,
    cancelConnectionDraft,
    canEdit,
    cursorPresence,
    documentWriter,
    dragHandlers,
    getEdgeCreationDefaults,
    isEdgeMode,
    isSelectMode,
  })

  const contextMenu = useCanvasContextMenu({
    activeTool,
    canEdit,
    campaignId,
    canvasParentId,
    nodesMap,
    edgesMap,
    createNode: documentWriter.createNode,
    screenToFlowPosition: reactFlow.screenToFlowPosition,
    selection,
    commands,
  })

  return {
    activeTool,
    canvasSurfaceRef,
    commands,
    contextMenu,
    documentWriter,
    dropTarget,
    editSession: session.editSession,
    flowHandlers,
    history,
    nodeActions,
    remoteHighlights: session.remoteHighlights,
    remoteUsers: session.remoteUsers,
    selection,
    toolCursor: activeToolSpec.cursor,
  }
}
