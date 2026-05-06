import { useEffect } from 'react'
import { useCanvasInteractionRuntime } from '../../runtime/providers/canvas-runtime'

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
  const { editSession } = useCanvasInteractionRuntime()
  const { pendingEditNodeId, setPendingEditNodeId } = editSession

  useEffect(() => {
    if (!selected || isEditing || pendingEditNodeId !== id) return
    startEditing()
    setPendingEditNodeId(null)
  }, [id, isEditing, pendingEditNodeId, selected, setPendingEditNodeId, startEditing])
}
