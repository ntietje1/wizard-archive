import { useEffect } from 'react'
import { useCanvasRuntimeContext } from '../../hooks/canvas-runtime-context'

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
  const { editSession } = useCanvasRuntimeContext()
  const { pendingEditNodeId, setPendingEditNodeId } = editSession

  useEffect(() => {
    if (!selected || isEditing || pendingEditNodeId !== id) return
    startEditing()
    setPendingEditNodeId(null)
  }, [id, isEditing, pendingEditNodeId, selected, setPendingEditNodeId, startEditing])
}
