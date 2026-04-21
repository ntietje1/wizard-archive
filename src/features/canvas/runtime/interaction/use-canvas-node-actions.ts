import { useMemo } from 'react'
import type { CanvasDocumentWriter, CanvasNodeActions } from '../../tools/canvas-tool-types'
import type { CanvasSessionRuntime } from '../session/use-canvas-session-state'
import type { ReactFlowInstance } from '@xyflow/react'

export function useCanvasNodeActions({
  documentWriter,
  reactFlowInstance,
  session,
}: {
  documentWriter: CanvasDocumentWriter
  reactFlowInstance: Pick<ReactFlowInstance, 'setNodes'>
  session: CanvasSessionRuntime
}) {
  return useMemo<CanvasNodeActions>(
    () => ({
      updateNodeData: documentWriter.updateNodeData,
      onResize: (nodeId, width, height, position) => {
        reactFlowInstance.setNodes((current) =>
          current.map((node) => (node.id === nodeId ? { ...node, width, height, position } : node)),
        )
        session.awareness.core.setLocalResizing({
          [nodeId]: { width, height, x: position.x, y: position.y },
        })
      },
      onResizeEnd: (nodeId, width, height, position) => {
        session.awareness.core.setLocalResizing(null)
        documentWriter.resizeNode(nodeId, width, height, position)
      },
    }),
    [documentWriter, reactFlowInstance, session.awareness.core],
  )
}
