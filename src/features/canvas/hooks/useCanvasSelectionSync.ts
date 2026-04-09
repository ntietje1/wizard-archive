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
  const editingEmbedIdRef = useRef(editingEmbedId)
  editingEmbedIdRef.current = editingEmbedId

  const handleSelectionChange = useCallback(
    ({ nodes }: { nodes: Array<Node> }) => {
      const nodeIds = nodes.map((n) => n.id)
      const prevIds = prevSelectionRef.current
      const changed =
        nodeIds.length !== prevIds.length ||
        (() => {
          const prevSet = new Set(prevIds)
          return nodeIds.some((id) => !prevSet.has(id))
        })()
      if (changed) {
        prevSelectionRef.current = nodeIds
        setLocalSelection(nodeIds.length > 0 ? nodeIds : null)
        onHistorySelectionChange(nodeIds)

        if (editingEmbedIdRef.current && !nodeIds.includes(editingEmbedIdRef.current)) {
          setEditingEmbedId(null)
        }

        const selectedSet = new Set(nodeIds)
        reactFlowInstance.setNodes((current) =>
          current.map((n) =>
            (n.draggable ?? false) === selectedSet.has(n.id)
              ? n
              : { ...n, draggable: selectedSet.has(n.id) },
          ),
        )
      }
    },
    [setLocalSelection, reactFlowInstance, onHistorySelectionChange, setEditingEmbedId],
  )

  useOnSelectionChange({ onChange: handleSelectionChange })
}
