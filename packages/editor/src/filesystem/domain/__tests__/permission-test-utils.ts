import type { ResourceId } from '../../../resources/domain-id'
import type { AnyItem } from '../../../workspace/items'

export function createPermissionLookup(items: Array<AnyItem>) {
  const itemsById = new Map<ResourceId, AnyItem>(items.map((item) => [item.id, item]))
  return (itemId: ResourceId) => itemsById.get(itemId) ?? null
}
