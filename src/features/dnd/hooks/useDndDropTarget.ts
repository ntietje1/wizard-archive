import { useDroppable } from '~/features/dnd/hooks/useDroppable'
import { useDndStore } from '~/features/dnd/stores/dnd-store'

/**
 * Unified drop target hook for all DnD zones.
 * Wraps useDroppable and returns reactive isDropTarget from the store.
 *
 * Targets accept drops by default so no-op drops stay in pragmatic-dnd's
 * dropTargets[] and do not fall through to ancestor zones. Surfaces can
 * opt out when the current actor cannot mutate that target.
 */
export function useDndDropTarget<T extends Record<string, unknown>>({
  ref,
  data,
  highlightId,
  canDrop = true,
}: {
  ref: React.RefObject<HTMLElement | null>
  data: T
  highlightId: string
  canDrop?: boolean
}): { isDropTarget: boolean } {
  useDroppable<T>({
    ref,
    data,
    canDrop: () => canDrop,
  })

  const isDropTarget = useDndStore((s) => s.sidebarDragTargetId === highlightId)

  return { isDropTarget: canDrop && isDropTarget }
}
