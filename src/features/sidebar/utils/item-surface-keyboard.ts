import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { ItemSurface } from '~/features/sidebar/stores/sidebar-ui-store'

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

function commonSelectedParentId(
  selectedItems: Array<AnySidebarItem>,
): Id<'sidebarItems'> | null | undefined {
  if (selectedItems.length === 0) return undefined
  const parentId = selectedItems[0].parentId
  return selectedItems.every((item) => item.parentId === parentId) ? parentId : undefined
}

export function getKeyboardPasteParentId({
  selectedItems,
  surface,
  surfaceParentId,
}: {
  selectedItems: Array<AnySidebarItem>
  surface: ItemSurface
  surfaceParentId: Id<'sidebarItems'> | null
}): Id<'sidebarItems'> | null {
  if (surface !== 'sidebar' && surface !== 'bookmarks') return surfaceParentId
  const selectedParentId = commonSelectedParentId(selectedItems)
  return selectedParentId === undefined ? surfaceParentId : selectedParentId
}
