import * as Y from 'yjs'
import { useLayoutEffect, useState } from 'react'
import { CanvasEditorSurface } from '~/features/canvas/components/canvas-editor-surface'
import { CanvasNodeContentRenderer } from '~/features/canvas/components/canvas-node-content-renderer'
import { CanvasPreviewDefaultEmbedNode } from '~/features/canvas/components/canvas-preview-default-embed-node'
import { CanvasPreviewStrokeNode } from '~/features/canvas/components/canvas-preview-stroke-node'
import { CanvasPreviewTextNode } from '~/features/canvas/components/canvas-preview-text-node'
import { CanvasEngineProvider } from '~/features/canvas/react/canvas-engine-context'
import { CanvasRuntimeProvider } from '~/features/canvas/runtime/providers/canvas-runtime'
import {
  useCanvasEditorRuntimeBase,
  useCanvasEditorSceneRuntime,
} from '~/features/canvas/runtime/use-canvas-editor-runtime-base'
import {
  createCanvasToolRuntime,
  getEdgeCreationDefaults,
} from '~/features/canvas/runtime/canvas-tool-runtime-adapter'
import { useCanvasContextMenuCore } from '~/features/canvas/runtime/context-menu/use-canvas-context-menu-core'
import { useCanvasCursorPresence } from '~/features/canvas/runtime/interaction/use-canvas-cursor-presence'
import { canvasToolSpecs } from '~/features/canvas/tools/canvas-tool-modules'
import type { CanvasConnection } from '~/features/canvas/types/canvas-domain-types'
import type { CanvasNodeRendererMap } from '~/features/canvas/components/canvas-node-content-renderer'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '~/features/canvas/domain/canvas-document'
import type { Id } from 'convex/_generated/dataModel'

const LOCAL_CANVAS_NODE_RENDERERS = {
  embed: CanvasPreviewDefaultEmbedNode,
  stroke: CanvasPreviewStrokeNode,
  text: CanvasPreviewTextNode,
} as const satisfies CanvasNodeRendererMap

interface LocalCanvasEditorProps {
  canvasId: Id<'sidebarItems'>
  nodes: ReadonlyArray<CanvasDocumentNode>
  edges: ReadonlyArray<CanvasDocumentEdge>
}

export function LocalCanvasEditor({ canvasId, nodes, edges }: LocalCanvasEditorProps) {
  const document = useLocalCanvasDocument({ canvasId, nodes, edges })
  const runtime = useLocalCanvasEditorRuntime({
    canvasId,
    doc: document.doc,
    nodesMap: document.nodesMap,
    edgesMap: document.edgesMap,
  })
  const canvasCursor = runtime.toolCursor ?? 'pointer'

  return (
    <CanvasEngineProvider engine={runtime.canvasEngine}>
      <CanvasRuntimeProvider
        canEdit
        commands={runtime.commands}
        documentWriter={runtime.documentWriter}
        domRuntime={runtime.domRuntime}
        editSession={runtime.editSession}
        history={runtime.history}
        nodeActions={runtime.nodeActions}
        remoteHighlights={runtime.remoteHighlights}
        selection={runtime.selection}
        viewportController={runtime.viewportController}
      >
        <LocalCanvasEditorContent runtime={runtime} canvasCursor={canvasCursor} />
      </CanvasRuntimeProvider>
    </CanvasEngineProvider>
  )
}

function useLocalCanvasDocument({
  canvasId,
  edges,
  nodes,
}: {
  canvasId: Id<'sidebarItems'>
  nodes: ReadonlyArray<CanvasDocumentNode>
  edges: ReadonlyArray<CanvasDocumentEdge>
}) {
  const [document] = useState<{
    canvasId: Id<'sidebarItems'>
    doc: Y.Doc
    nodesMap: Y.Map<CanvasDocumentNode>
    edgesMap: Y.Map<CanvasDocumentEdge>
  }>(() => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<CanvasDocumentNode>('nodes')
    const edgesMap = doc.getMap<CanvasDocumentEdge>('edges')
    doc.transact(() => {
      nodes.forEach((node) => nodesMap.set(node.id, node))
      edges.forEach((edge) => edgesMap.set(edge.id, edge))
    }, 'demo-canvas-init')
    return { canvasId, doc, nodesMap, edgesMap }
  })

  useLayoutEffect(() => {
    return () => {
      document.doc.destroy()
    }
  }, [document])

  return document
}

function useLocalCanvasEditorRuntime({
  canvasId,
  doc,
  edgesMap,
  nodesMap,
}: {
  canvasId: Id<'sidebarItems'>
  doc: Y.Doc
  nodesMap: Y.Map<CanvasDocumentNode>
  edgesMap: Y.Map<CanvasDocumentEdge>
}) {
  const base = useCanvasEditorRuntimeBase({
    nodesMap,
    edgesMap,
    canvasId,
    canEdit: true,
    provider: null,
    initialViewport: { x: 0, y: 0, zoom: 1 },
  })

  const activeTool = base.activeTool
  const tools = useLocalCanvasToolRuntime({
    activeTool,
    canvasEngine: base.canvasEngine,
    commands: base.document.commands,
    documentWriter: base.document.documentWriter,
    modifiers: base.modifiers,
    pointerRouter: base.pointerRouter,
    selection: base.selection,
    session: base.session,
    viewportController: base.viewportController,
  })
  const sceneHandlers = useCanvasEditorSceneRuntime({
    activeTool,
    activeToolHandlers: tools.activeToolHandlers,
    canvasEngine: base.canvasEngine,
    canvasId,
    canvasSurfaceRef: base.canvasSurfaceRef,
    canEdit: true,
    createEdgeFromConnection: tools.createEdgeFromConnection,
    cursorPresence: tools.cursorPresence,
    doc,
    documentWriter: base.document.documentWriter,
    edgesMap,
    modifiers: base.modifiers,
    nodesMap,
    pointerRouter: base.pointerRouter,
    selection: base.selection,
    session: base.session,
    viewportController: base.viewportController,
  })

  return {
    activeTool,
    canvasEngine: base.canvasEngine,
    canvasSurfaceRef: base.canvasSurfaceRef,
    commands: base.document.commands,
    contextMenu: tools.contextMenu,
    documentWriter: base.document.documentWriter,
    domRuntime: base.domRuntime,
    editSession: base.session.editSession,
    sceneHandlers,
    history: base.document.history,
    nodeActions: base.document.nodeActions,
    viewportController: base.viewportController,
    remoteHighlights: base.session.remoteHighlights,
    remoteUsers: base.session.remoteUsers,
    selection: base.selection,
    toolCursor: tools.activeToolSpec.cursor,
  }
}

function useLocalCanvasToolRuntime({
  activeTool,
  canvasEngine,
  commands,
  documentWriter,
  modifiers,
  pointerRouter,
  selection,
  session,
  viewportController,
}: {
  activeTool: keyof typeof canvasToolSpecs
  canvasEngine: ReturnType<typeof useCanvasEditorRuntimeBase>['canvasEngine']
  commands: ReturnType<typeof useCanvasEditorRuntimeBase>['document']['commands']
  documentWriter: ReturnType<typeof useCanvasEditorRuntimeBase>['document']['documentWriter']
  modifiers: ReturnType<typeof useCanvasEditorRuntimeBase>['modifiers']
  pointerRouter: ReturnType<typeof useCanvasEditorRuntimeBase>['pointerRouter']
  selection: ReturnType<typeof useCanvasEditorRuntimeBase>['selection']
  session: ReturnType<typeof useCanvasEditorRuntimeBase>['session']
  viewportController: ReturnType<typeof useCanvasEditorRuntimeBase>['viewportController']
}) {
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
    viewportController,
  })
  const activeToolHandlers = activeToolSpec.createHandlers(toolRuntime)
  const contextMenu = useCanvasContextMenuCore({
    activeTool,
    canEdit: true,
    canvasEngine,
    createNode: documentWriter.createNode,
    setPendingEditNodeId: session.editSession.setPendingEditNodeId,
    setPendingEditNodePoint: session.editSession.setPendingEditNodePoint,
    screenToCanvasPosition: viewportController.screenToCanvasPosition,
    selection,
    commands,
  })
  const createEdgeFromConnection = (connection: CanvasConnection) => {
    if (activeTool !== 'edge') return
    documentWriter.createEdge(connection, getEdgeCreationDefaults())
  }

  return {
    activeToolHandlers,
    activeToolSpec,
    contextMenu,
    cursorPresence,
    createEdgeFromConnection,
  }
}

function LocalCanvasEditorContent({
  runtime,
  canvasCursor,
}: {
  runtime: ReturnType<typeof useLocalCanvasEditorRuntime>
  canvasCursor: string
}) {
  return (
    <CanvasEditorSurface
      canEdit
      canvasCursor={canvasCursor}
      canvasSurfaceRef={runtime.canvasSurfaceRef}
      contextMenu={runtime.contextMenu}
      NodeContentComponent={LocalCanvasNodeContent}
      remoteUsers={runtime.remoteUsers}
      sceneHandlers={runtime.sceneHandlers}
    />
  )
}

function LocalCanvasNodeContent({ nodeId }: { nodeId: string }) {
  return <CanvasNodeContentRenderer nodeId={nodeId} renderers={LOCAL_CANVAS_NODE_RENDERERS} />
}
