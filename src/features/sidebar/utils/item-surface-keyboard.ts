import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'

export function getKeyboardOpenItem({
  selectedItems,
  focusedItemId,
}: {
  selectedItems: Array<AnySidebarItem>
  focusedItemId: Id<'sidebarItems'> | null
}): AnySidebarItem | null {
  if (selectedItems.length <= 1) return selectedItems[0] ?? null
  return selectedItems.find((item) => item._id === focusedItemId) ?? selectedItems[0]
}
