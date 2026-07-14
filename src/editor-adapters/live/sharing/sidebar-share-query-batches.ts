import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'

const MAX_SIDEBAR_SHARE_ITEMS_PER_QUERY = 100

export function createSidebarShareQueryItemIdBatches(
  itemIds: Array<ResourceId>,
): Array<Array<ResourceId>> {
  const batches: Array<Array<ResourceId>> = []
  for (let start = 0; start < itemIds.length; start += MAX_SIDEBAR_SHARE_ITEMS_PER_QUERY) {
    batches.push(itemIds.slice(start, start + MAX_SIDEBAR_SHARE_ITEMS_PER_QUERY))
  }
  return batches
}
