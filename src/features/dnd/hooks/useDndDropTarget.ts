import { useDroppable } from '~/features/dnd/hooks/useDroppable'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'

/**
 * Unified drop target hook for all DnD zones.
 * Wraps useDroppable and returns reactive isDropTarget from the store.
 *
 * canDrop always returns true so the target stays in pragmatic-dnd's
 * dropTargets[] even for no-op drops — this prevents the drag from
 * "falling through" to ancestor drop zones. No-op suppression (hiding
 * the highlight / overlay) is handled in DndProvider's onDrag handler.
 */
export function useDndDropTarget<T extends Record<string, unknown>>({
  ref,
  data,
  highlightId,
}: {
  ref: React.RefObject<HTMLElement | null>
  data: T
  highlightId: string
}): { isDropTarget: boolean } {
  useDroppable<T>({
    ref,
    data,
  })

  const isDropTarget = useSidebarUIStore(
    (s) => s.sidebarDragTargetId === highlightId,
  )

  return { isDropTarget }
}
