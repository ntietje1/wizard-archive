import { useReactFlow, useStoreApi } from '@xyflow/react'
import type { Id } from 'convex/_generated/dataModel'
import { useEffect, useRef } from 'react'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'
import { getMeasuredCanvasNodesFromLookup } from './document/canvas-measured-nodes'
import { useCanvasDocumentProjection } from './document/use-canvas-document-projection'
import { useCanvasDocumentWriter } from './document/use-canvas-document-writer'
import { useCanvasHistory } from './document/use-canvas-history'
import { useCanvasKeyboardShortcuts } from './document/use-canvas-keyboard-shortcuts'
import { useCanvasContextMenu } from './context-menu/use-canvas-context-menu'
import { transactCanvasMaps } from './document/canvas-yjs-transactions'
import { useCanvasCursorPresence } from './interaction/use-canvas-cursor-presence'
import { useCanvasDropIntegration } from './interaction/use-canvas-drop-integration'
import { useCanvasFlowHandlers } from './interaction/use-canvas-flow-handlers'
import { useCanvasModifierKeys } from './interaction/use-canvas-modifier-keys'
import { useCanvasNodeActions } from './interaction/use-canvas-node-actions'
import { useCanvasNodeDragHandlers } from './interaction/use-canvas-node-drag-handlers'
import { useCanvasPointerBridge } from './interaction/use-canvas-pointer-bridge'
import { useCanvasRemoteDragAnimation } from './interaction/use-canvas-remote-drag-animation'
import { useCanvasSurfaceClickGuard } from './interaction/use-canvas-surface-click-guard'
import { useCanvasWheel } from './interaction/use-canvas-wheel'
import { clearCanvasSelectionState } from './selection/use-canvas-selection-state'
import { useCanvasSelectionController } from './selection/use-canvas-selection-actions'
import { useCanvasSelectionRect } from './selection/use-canvas-selection-rect'
import { useCanvasSessionState } from './session/use-canvas-session-state'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import {
  clearCanvasToolTransientState,
  createCanvasToolHandlers,
  getCanvasToolCursor,
} from '../tools/canvas-tool-modules'
import type { CanvasToolHandlers, CanvasToolRuntime } from '../tools/canvas-tool-types'
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
  const historySelectionChangeRef = useRef<
    (selection: { nodeIds: Array<string>; edgeIds: Array<string> }) => void
  >(() => undefined)
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
      clearCanvasToolTransientState(activeTool, session.awareness.presence)
    }
  }, [activeTool, session.awareness.presence])

  useYjsPreviewUpload({
    itemId: canvasId,
    doc,
    containerRef: canvasSurfaceRef,
    resolveElement: (container) => container,
  })

  const documentWriter = useCanvasDocumentWriter({
    nodesMap,
    edgesMap,
  })

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

  useCanvasKeyboardShortcuts({
    undo: history.undo,
    redo: history.redo,
    canEdit,
    nodesMap,
    edgesMap,
    selection,
  })

  const dragHandlers = useCanvasNodeDragHandlers({
    documentWriter,
    nodesDoc: doc,
    remoteDragAnimation,
    awareness: session.awareness.core,
    reactFlowInstance: reactFlow,
    localDraggingIdsRef,
  })

  const cursorPresence = useCanvasCursorPresence({
    reactFlowInstance: reactFlow,
    awareness: session.awareness.core,
  })

  const nodeActions = useCanvasNodeActions({
    documentWriter,
    reactFlowInstance: reactFlow,
    session,
    transact: (fn) => transactCanvasMaps(nodesMap, edgesMap, fn),
  })

  const interaction = useCanvasSurfaceClickGuard(canvasSurfaceRef)
  const isSelectMode = activeTool === 'select'
  const modifiers = useCanvasModifierKeys()

  useCanvasSelectionRect({
    surfaceRef: canvasSurfaceRef,
    awareness: session.awareness.presence,
    selection,
    interaction,
    enabled: canEdit && isSelectMode,
  })

  const toolRuntimeRef = useRef<CanvasToolRuntime | null>(null)
  toolRuntimeRef.current ??= {
    viewport: {
      getZoom: () => 1,
      screenToFlowPosition: (position) => position,
    },
    commands: documentWriter,
    query: {
      getNodes: () => [],
      getEdges: () => [],
      getMeasuredNodes: () => [],
    },
    selection,
    interaction,
    modifiers: {
      getPrimaryPressed: () => false,
      getShiftPressed: () => false,
    },
    editSession: session.editSession,
    toolState: {
      getSettings: () => ({
        strokeColor: useCanvasToolStore.getState().strokeColor,
        strokeOpacity: useCanvasToolStore.getState().strokeOpacity,
        strokeSize: useCanvasToolStore.getState().strokeSize,
      }),
      getActiveTool: () => useCanvasToolStore.getState().activeTool,
      setActiveTool: (tool) => useCanvasToolStore.getState().setActiveTool(tool),
      setStrokeColor: (color) => useCanvasToolStore.getState().setStrokeColor(color),
      setStrokeSize: (size) => useCanvasToolStore.getState().setStrokeSize(size),
      setStrokeOpacity: (opacity) => useCanvasToolStore.getState().setStrokeOpacity(opacity),
    },
    awareness: session.awareness,
  }
  toolRuntimeRef.current.viewport = {
    screenToFlowPosition: reactFlow.screenToFlowPosition,
    getZoom: () => reactFlow.getZoom(),
  }
  toolRuntimeRef.current.commands = documentWriter
  toolRuntimeRef.current.query = {
    getNodes: reactFlow.getNodes,
    getEdges: reactFlow.getEdges,
    getMeasuredNodes: () => getMeasuredCanvasNodesFromLookup(storeApi.getState().nodeLookup),
  }
  toolRuntimeRef.current.selection = selection
  toolRuntimeRef.current.interaction = interaction
  toolRuntimeRef.current.modifiers = {
    getShiftPressed: () => modifiers.shiftPressed,
    getPrimaryPressed: () => modifiers.primaryPressed,
  }
  toolRuntimeRef.current.editSession = session.editSession
  toolRuntimeRef.current.awareness = session.awareness

  const activeToolHandlersRef = useRef<{
    toolId: typeof activeTool
    handlers: CanvasToolHandlers
  } | null>(null)
  if (!activeToolHandlersRef.current || activeToolHandlersRef.current.toolId !== activeTool) {
    activeToolHandlersRef.current = {
      toolId: activeTool,
      handlers: createCanvasToolHandlers(activeTool, toolRuntimeRef.current),
    }
  }
  const activeToolHandlers = activeToolHandlersRef.current.handlers

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

  const flowHandlers = useCanvasFlowHandlers({
    activeToolHandlers,
    canEdit,
    cursorPresence,
    documentWriter,
    dragHandlers,
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
  })

  return {
    activeTool,
    canvasSurfaceRef,
    contextMenu,
    dropTarget,
    editSession: session.editSession,
    flowHandlers,
    history,
    nodeActions,
    remoteHighlights: session.remoteHighlights,
    remoteUsers: session.remoteUsers,
    selection,
    toolCursor: getCanvasToolCursor(activeTool),
  }
}
