import { useEffect, useRef } from 'react'
import { useCanvasSelectionSnapshot } from './use-canvas-selection-state'
import type { CanvasSelectionSnapshot } from '../../tools/canvas-tool-types'

interface UseCanvasSelectionSyncOptions {
  setLocalSelection: (nodeIds: Array<string> | null) => void
  onHistorySelectionChange: (selection: CanvasSelectionSnapshot) => void
}

function hasSameIds(nextIds: Array<string>, prevIds: Array<string>) {
  if (nextIds.length !== prevIds.length) return false
  const prevIdSet = new Set(prevIds)
  return nextIds.every((id) => prevIdSet.has(id))
}

export function useCanvasSelectionSync({
  setLocalSelection,
  onHistorySelectionChange,
}: UseCanvasSelectionSyncOptions) {
  const selection = useCanvasSelectionSnapshot()
  const prevSelectionRef = useRef<CanvasSelectionSnapshot>({ nodeIds: [], edgeIds: [] })

  useEffect(() => {
    const prevSelection = prevSelectionRef.current
    const changed =
      !hasSameIds(selection.nodeIds, prevSelection.nodeIds) ||
      !hasSameIds(selection.edgeIds, prevSelection.edgeIds)
    if (!changed) return

    prevSelectionRef.current = selection
    setLocalSelection(selection.nodeIds.length > 0 ? selection.nodeIds : null)
    onHistorySelectionChange(selection)
  }, [onHistorySelectionChange, selection, setLocalSelection])
}
