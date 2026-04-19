import { useEffect, useRef } from 'react'
import { useSelectedCanvasNodeIds } from './useCanvasSelectionState'

interface UseCanvasSelectionSyncOptions {
  setLocalSelection: (nodeIds: Array<string> | null) => void
  onHistorySelectionChange: (nodeIds: Array<string>) => void
}

export function useCanvasSelectionSync({
  setLocalSelection,
  onHistorySelectionChange,
}: UseCanvasSelectionSyncOptions) {
  const selectedNodeIds = useSelectedCanvasNodeIds()
  const prevSelectionRef = useRef<Array<string>>([])

  useEffect(() => {
    const prevIds = prevSelectionRef.current
    let changed = selectedNodeIds.length !== prevIds.length
    if (!changed) {
      const prevSet = new Set(prevIds)
      changed = selectedNodeIds.some((id) => !prevSet.has(id))
    }
    if (!changed) return

    prevSelectionRef.current = selectedNodeIds
    setLocalSelection(selectedNodeIds.length > 0 ? selectedNodeIds : null)
    onHistorySelectionChange(selectedNodeIds)
  }, [onHistorySelectionChange, selectedNodeIds, setLocalSelection])
}
