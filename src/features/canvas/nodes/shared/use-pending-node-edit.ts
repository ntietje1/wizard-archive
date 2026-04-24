import { useEffect } from 'react'
import { useCanvasRuntime } from '../../runtime/providers/canvas-runtime'

interface UsePendingNodeEditOptions {
  id: string
  selected: boolean
  isEditing: boolean
  startEditing: () => void
}

export function usePendingNodeEdit({
  id,
  selected,
  isEditing,
  startEditing,
}: UsePendingNodeEditOptions) {
  const {
    editSession: { pendingEditNodeId, setPendingEditNodeId },
  } = useCanvasRuntime()

  useEffect(() => {
    if (!selected || isEditing || pendingEditNodeId !== id) return
    startEditing()
    setPendingEditNodeId(null)
  }, [id, isEditing, pendingEditNodeId, selected, setPendingEditNodeId, startEditing])
}
