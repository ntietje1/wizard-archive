import { useDroppable } from './use-droppable'
import { useDndStore } from './store'
import { useDndRuntimeDropData } from './context'
import { getDropTargetKey } from './drop-target-data'

/**
 * Unified drop target hook for all DnD zones.
 * Wraps useDroppable and returns reactive isDropTarget from the store.
 *
 * Targets accept drops by default so no-op drops stay in pragmatic-dnd's
 * dropTargets[] and do not fall through to ancestor zones. Surfaces can
 * opt out when the current actor cannot mutate that target.
 */
export function useDndDropTarget<T extends Record<string, unknown>>({
  data,
  canDrop = true,
}: {
  data: T
  canDrop?: boolean
}): {
  dropTargetRef: (node: HTMLElement | null) => void
  dropTargetKey: string | null
  isDropTarget: boolean
} {
  const scopedData = useDndRuntimeDropData(data)
  const dropTargetKey = getDropTargetKey(scopedData)
  const { droppableRef } = useDroppable<T>({
    data: scopedData,
    canDrop: () => canDrop,
  })

  const isDropTarget = useDndStore((s) => s.activeDropTargetKey === dropTargetKey)

  return { dropTargetRef: droppableRef, dropTargetKey, isDropTarget: canDrop && isDropTarget }
}
