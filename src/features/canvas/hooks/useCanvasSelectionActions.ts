import { useMemo } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { CanvasDocumentReader, CanvasSelectionActions } from '../tools/canvas-tool-types'

export function useCanvasSelectionActions(): CanvasSelectionActions & CanvasDocumentReader {
  const reactFlow = useReactFlow()

  return useMemo(
    () => ({
      setNodeSelection: (nodeIds) => {
        const nodeIdSet = new Set(nodeIds)
        reactFlow.setNodes((nodes) =>
          nodes.map((node) => {
            const selected = nodeIdSet.has(node.id)
            const draggable = node.draggable ?? true
            if (node.selected === selected && draggable === selected) {
              return node
            }
            return { ...node, selected, draggable: selected }
          }),
        )
        reactFlow.setEdges((edges) =>
          edges.map((edge) => {
            const selected = nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target)
            return edge.selected === selected ? edge : { ...edge, selected }
          }),
        )
      },
      clearSelection: () => {
        reactFlow.setNodes((nodes) =>
          nodes.map((node) =>
            node.selected || (node.draggable ?? false)
              ? { ...node, selected: false, draggable: false }
              : node,
          ),
        )
        reactFlow.setEdges((edges) =>
          edges.map((edge) => (edge.selected ? { ...edge, selected: false } : edge)),
        )
      },
      getNodes: () => reactFlow.getNodes(),
      getEdges: () => reactFlow.getEdges(),
    }),
    [reactFlow],
  )
}
