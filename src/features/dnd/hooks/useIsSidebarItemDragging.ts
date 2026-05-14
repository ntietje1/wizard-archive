import type { Id } from 'convex/_generated/dataModel'
import { useDndStore } from '~/features/dnd/stores/dnd-store'

export function useIsSidebarItemDragging(itemId: Id<'sidebarItems'>) {
  return useDndStore((state) => state.sidebarDragPreviewItemIds.includes(itemId))
}
