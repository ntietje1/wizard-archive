import type { CanvasDocumentWriter, CanvasNodeActions } from '../../tools/canvas-tool-types'
import type { CanvasSessionRuntime } from '../session/use-canvas-session-state'
import type { CanvasEngine } from '../../system/canvas-engine'
import type { CanvasNode } from '../../types/canvas-domain-types'

export function createCanvasNodeActions({
  canvasEngine,
  documentWriter,
  session,
  transact,
}: {
  canvasEngine: CanvasEngine
  documentWriter: CanvasDocumentWriter
  session: CanvasSessionRuntime
  transact: (fn: () => void) => void
}) {
  return {
    transact,
    onResize: (nodeId, width, height, position) => {
      previewNodeResize(canvasEngine, session, new Map([[nodeId, { width, height, position }]]))
    },
    onResizeEnd: (nodeId, width, height, position) => {
      session.awareness.core.setLocalResizing(null)
      documentWriter.resizeNode(nodeId, width, height, position)
    },
    onResizeMany: (updates) => {
      previewNodeResize(canvasEngine, session, updates)
    },
    onResizeManyCancel: (updates) => {
      canvasEngine.patchNodes(createNodeResizePatches(updates))
      session.awareness.core.setLocalResizing(null)
    },
    onResizeManyEnd: (updates) => {
      session.awareness.core.setLocalResizing(null)
      documentWriter.resizeNodes(updates)
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

  canvasEngine.patchNodes(createNodeResizePatches(updates))
  session.awareness.core.setLocalResizing(resizing)
}

function createNodeResizePatches(updates: Parameters<CanvasNodeActions['onResizeMany']>[0]) {
  const nodePatches = new Map<string, Partial<CanvasNode>>()
  for (const [nodeId, update] of updates) {
    nodePatches.set(nodeId, update)
  }
  return nodePatches
}
