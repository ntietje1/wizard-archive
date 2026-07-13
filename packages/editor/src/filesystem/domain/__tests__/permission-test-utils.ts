import type { SidebarItemId } from '../../../../../../shared/common/ids'
import type { AnyItem } from '../../../workspace/items'

export function createPermissionLookup(items: Array<AnyItem>) {
  const itemsById = new Map<SidebarItemId, AnyItem>(items.map((item) => [item.id, item]))
  return (itemId: SidebarItemId) => itemsById.get(itemId) ?? null
}
