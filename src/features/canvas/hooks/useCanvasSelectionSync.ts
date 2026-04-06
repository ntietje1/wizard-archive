import { useCallback, useRef } from 'react'
import { useOnSelectionChange, useReactFlow } from '@xyflow/react'
import type { Node } from '@xyflow/react'

interface UseCanvasSelectionSyncOptions {
  setLocalSelection: (nodeIds: Array<string> | null) => void
  onHistorySelectionChange: (nodeIds: Array<string>) => void
  editingEmbedId: string | null
  setEditingEmbedId: (id: string | null) => void
}

export function useCanvasSelectionSync({
  setLocalSelection,
  onHistorySelectionChange,
  editingEmbedId,
  setEditingEmbedId,
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

        if (editingEmbedId && !nodeIds.includes(editingEmbedId)) {
          setEditingEmbedId(null)
        }

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
    [
      setLocalSelection,
      reactFlowInstance,
      onHistorySelectionChange,
      editingEmbedId,
      setEditingEmbedId,
    ],
  )

  useOnSelectionChange({ onChange: handleSelectionChange })
}
