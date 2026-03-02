import { useDnd } from './useDnd'
import type { SidebarDragData } from '~/lib/dnd-registry'
import { wouldDropHaveEffect } from '~/lib/dnd-registry'
import { useDroppable } from '~/hooks/useDroppable'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'

/**
 * Unified drop target hook for all DnD zones.
 * Wraps useDroppable with automatic canDrop (via wouldDropHaveEffect)
 * and returns reactive isDropTarget from the store.
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
  const { resolveItem, resolveDropTarget } = useDnd()

  useDroppable<T, SidebarDragData>({
    ref,
    data,
    canDrop: (sourceData) => {
      const item = resolveItem(sourceData.sidebarItemId)
      const target = resolveDropTarget(data)
      return wouldDropHaveEffect(item, target)
    },
  })

  const isDropTarget = useSidebarUIStore(
    (s) => s.sidebarDragTargetId === highlightId,
  )

  return { isDropTarget }
}
