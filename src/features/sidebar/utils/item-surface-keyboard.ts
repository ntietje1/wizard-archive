import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
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

export function getKeyboardPasteParentId({
  selectedItems,
  focusedItemId,
  surfaceParentId,
}: {
  selectedItems: Array<AnySidebarItem>
  focusedItemId: Id<'sidebarItems'> | null
  surfaceParentId: Id<'sidebarItems'> | null
}): Id<'sidebarItems'> | null {
  const focusedItem = selectedItems.find((item) => item._id === focusedItemId)
  const candidate = selectedItems.length === 1 ? selectedItems[0] : focusedItem
  return candidate &&
    candidate.type === SIDEBAR_ITEM_TYPES.folders &&
    candidate.location !== SIDEBAR_ITEM_LOCATION.trash
    ? candidate._id
    : surfaceParentId
}
