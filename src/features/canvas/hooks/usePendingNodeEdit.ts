import { useEffect } from 'react'
import { useCanvasEditSession } from './useCanvasContext'

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
  const { pendingEditNodeId, setPendingEditNodeId } = useCanvasEditSession()

  useEffect(() => {
    if (!selected || isEditing || pendingEditNodeId !== id) return
    startEditing()
    setPendingEditNodeId(null)
  }, [id, isEditing, pendingEditNodeId, selected, setPendingEditNodeId, startEditing])
}
