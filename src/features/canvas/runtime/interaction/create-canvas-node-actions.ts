import type { CanvasDocumentWriter, CanvasNodeActions } from '../../tools/canvas-tool-types'
import type { CanvasSessionRuntime } from '../session/use-canvas-session-state'
import type { CanvasEngine } from '../../system/canvas-engine'

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
      canvasEngine.patchNodes(new Map([[nodeId, { width, height, position }]]))
      session.awareness.core.setLocalResizing({
        [nodeId]: { width, height, x: position.x, y: position.y },
      })
    },
    onResizeEnd: (nodeId, width, height, position) => {
      session.awareness.core.setLocalResizing(null)
      documentWriter.resizeNode(nodeId, width, height, position)
    },
  } satisfies CanvasNodeActions
}
