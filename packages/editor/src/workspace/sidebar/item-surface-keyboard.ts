import type { ResourceId } from '../../resources/domain-id'
import { assertNever } from './utils/assert-never'
import type { AnyItem } from '../items'
import type { SidebarWorkspaceItemSurfaceName } from './workspace-state'

export function getKeyboardOpenItem({
  selectedItems,
  focusedItemId,
}: {
  selectedItems: Array<AnyItem>
  focusedItemId: ResourceId | null
}): AnyItem | null {
  if (selectedItems.length <= 1) return selectedItems[0] ?? null
  return selectedItems.find((item) => item.id === focusedItemId) ?? selectedItems[0]
}

export function getKeyboardPasteParentId({
  selectedItems,
  surface,
  surfaceParentId,
}: {
  selectedItems: Array<AnyItem>
  surface: SidebarWorkspaceItemSurfaceName
  surfaceParentId: ResourceId | null
}): ResourceId | null {
  switch (surface) {
    case 'folder-view':
    case 'trash':
      return surfaceParentId
    case 'bookmarks':
    case 'sidebar':
      break
    default:
      return assertNever(surface, 'Unhandled sidebar item surface')
  }

  if (selectedItems.length === 0) return surfaceParentId
  const [firstItem] = selectedItems
  if (selectedItems.every((item) => item.parentId === firstItem.parentId)) {
    return firstItem.parentId
  }

  return surfaceParentId
}
