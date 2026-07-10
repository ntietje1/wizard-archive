import type { CanvasDocumentWriter, CanvasNodeActions } from '../../tools/canvas-tool-types'
import type { CanvasSessionRuntime } from '../session/use-canvas-session-state'
import type { CanvasEngine } from '../../system/canvas-engine-types'
import type { CanvasDocumentNodePatch } from '../../types/canvas-domain-types'

export function createCanvasNodeActions({
  canvasEngine,
  canEdit = true,
  documentWriter,
  session,
  transact,
}: {
  canvasEngine: CanvasEngine
  canEdit?: boolean
  documentWriter: CanvasDocumentWriter
  session: CanvasSessionRuntime
  transact: (fn: () => void) => void
}) {
  return {
    ...(canEdit ? { transact } : {}),
    onResize: (nodeId, width, height, position) => {
      if (!canEdit) return
      previewNodeResize(canvasEngine, session, new Map([[nodeId, { width, height, position }]]))
    },
    onResizeEnd: (nodeId, width, height, position) => {
      if (!canEdit) return
      commitNodeResize(
        canvasEngine,
        session,
        new Map([[nodeId, { width, height, position }]]),
        () => documentWriter.resizeNode(nodeId, width, height, position),
      )
    },
    onResizeMany: (updates) => {
      if (!canEdit) return
      previewNodeResize(canvasEngine, session, updates)
    },
    onResizeManyCancel: (updates) => {
      if (!canEdit) return
      canvasEngine.updateResize(createNodeResizePatches(updates))
      session.awareness.core.setLocalResizing(null)
    },
    onResizeManyEnd: (updates) => {
      if (!canEdit) return
      commitNodeResize(canvasEngine, session, updates, () => documentWriter.resizeNodes(updates))
    },
  } satisfies CanvasNodeActions
}

function previewNodeResize(
  canvasEngine: CanvasEngine,
  session: CanvasSessionRuntime,
  updates: Parameters<CanvasNodeActions['onResizeMany']>[0],
) {
  const resizing: Record<string, { width: number; height: number; x: number; y: number }> = {}

  for (const [nodeId, update] of updates) {
    resizing[nodeId] = {
      width: update.width,
      height: update.height,
      x: update.position.x,
      y: update.position.y,
    }
  }

  canvasEngine.updateResize(createNodeResizePatches(updates))
  session.awareness.core.setLocalResizing(resizing)
}

function createNodeResizePatches(updates: Parameters<CanvasNodeActions['onResizeMany']>[0]) {
  return new Map<string, CanvasDocumentNodePatch>(updates)
}

function commitNodeResize(
  canvasEngine: CanvasEngine,
  session: CanvasSessionRuntime,
  updates: Parameters<CanvasNodeActions['onResizeMany']>[0],
  writeDocumentResize: () => void,
) {
  canvasEngine.updateResize(createNodeResizePatches(updates))
  session.awareness.core.setLocalResizing(null)
  writeDocumentResize()
}
