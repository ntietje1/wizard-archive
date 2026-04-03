import { useCallback, useRef } from 'react'
import { useOnSelectionChange, useReactFlow } from '@xyflow/react'
import type { Node } from '@xyflow/react'

interface UseCanvasSelectionSyncOptions {
  setLocalSelection: (nodeIds: Array<string> | null) => void
  onHistorySelectionChange: (nodeIds: Array<string>) => void
}

export function useCanvasSelectionSync({
  setLocalSelection,
  onHistorySelectionChange,
}: UseCanvasSelectionSyncOptions) {
  const reactFlowInstance = useReactFlow()
  const prevSelectionRef = useRef<Array<string>>([])

  const handleSelectionChange = useCallback(
    ({ nodes }: { nodes: Array<Node> }) => {
      const nodeIds = nodes.map((n) => n.id)
      if (
        nodeIds.length !== prevSelectionRef.current.length ||
        nodeIds.some((id, i) => id !== prevSelectionRef.current[i])
      ) {
        prevSelectionRef.current = nodeIds
        setLocalSelection(nodeIds.length > 0 ? nodeIds : null)
        onHistorySelectionChange(nodeIds)

        const selectedSet = new Set(nodeIds)
        reactFlowInstance.setNodes((current) =>
          current.map((n) =>
            n.draggable === selectedSet.has(n.id)
              ? n
              : { ...n, draggable: selectedSet.has(n.id) },
          ),
        )
      }
    },
    [setLocalSelection, reactFlowInstance, onHistorySelectionChange],
  )

  useOnSelectionChange({ onChange: handleSelectionChange })
}
