import type { Id } from 'convex/_generated/dataModel'
import type * as Y from 'yjs'
import {
  useCanvasEditorRuntimeBase,
  useCanvasEditorSceneRuntime,
} from './use-canvas-editor-runtime-base'
import { useCanvasToolRuntimeCore } from './use-canvas-tool-runtime-core'
import type { CanvasViewport } from '../types/canvas-domain-types'
import type { ConvexYjsProvider } from '~/shared/collaboration/convex-yjs-provider'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '~/features/canvas/domain/canvas-document'

export interface UseCanvasEditorRuntimeCoreOptions {
  nodesMap: Y.Map<CanvasDocumentNode>
  edgesMap: Y.Map<CanvasDocumentEdge>
  canvasId: Id<'sidebarItems'>
  campaignId?: Id<'campaigns'>
  canvasParentId: Id<'sidebarItems'> | null
  canEdit: boolean
  provider: ConvexYjsProvider | null
  doc: Y.Doc
  initialViewport: CanvasViewport
}

export function useCanvasEditorRuntimeCore({
  nodesMap,
  edgesMap,
  canvasId,
  campaignId,
  canvasParentId,
  canEdit,
  provider,
  doc,
  initialViewport,
}: UseCanvasEditorRuntimeCoreOptions) {
  const base = useCanvasEditorRuntimeBase({
    nodesMap,
    edgesMap,
    canvasId,
    canEdit,
    provider,
    initialViewport,
  })
  const tools = useCanvasToolRuntimeCore({
    activeTool: base.activeTool,
    campaignId,
    canvasEngine: base.canvasEngine,
    canvasParentId,
    canEdit,
    commands: base.document.commands,
    documentWriter: base.document.documentWriter,
    modifiers: base.modifiers,
    pointerRouter: base.pointerRouter,
    selection: base.selection,
    session: base.session,
    viewportController: base.viewportController,
  })
  const sceneHandlers = useCanvasEditorSceneRuntime({
    activeTool: base.activeTool,
    activeToolHandlers: tools.activeToolHandlers,
    canvasEngine: base.canvasEngine,
    canvasId,
    canvasSurfaceRef: base.canvasSurfaceRef,
    canEdit,
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
    activeTool: base.activeTool,
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
