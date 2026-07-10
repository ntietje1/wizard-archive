import type { Id } from 'convex/_generated/dataModel'

const MAX_SIDEBAR_SHARE_ITEMS_PER_QUERY = 100

export function createSidebarShareQueryItemIdBatches(
  itemIds: Array<Id<'sidebarItems'>>,
): Array<Array<Id<'sidebarItems'>>> {
  const batches: Array<Array<Id<'sidebarItems'>>> = []
  for (let start = 0; start < itemIds.length; start += MAX_SIDEBAR_SHARE_ITEMS_PER_QUERY) {
    batches.push(itemIds.slice(start, start + MAX_SIDEBAR_SHARE_ITEMS_PER_QUERY))
  }
  return batches
}
