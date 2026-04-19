import { useEffect } from 'react'
import { useCanvasEditSessionContext } from '../../runtime/providers/canvas-runtime-context'

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
  const { pendingEditNodeId, setPendingEditNodeId } = useCanvasEditSessionContext()

  useEffect(() => {
    if (!selected || isEditing || pendingEditNodeId !== id) return
    startEditing()
    setPendingEditNodeId(null)
  }, [id, isEditing, pendingEditNodeId, selected, setPendingEditNodeId, startEditing])
}
