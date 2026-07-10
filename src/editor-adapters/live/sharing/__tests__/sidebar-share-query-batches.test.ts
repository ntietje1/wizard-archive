import { describe, expect, it } from 'vite-plus/test'
import type { Id } from 'convex/_generated/dataModel'
import { createSidebarShareQueryItemIdBatches } from '../sidebar-share-query-batches'

describe('createSidebarShareQueryItemIdBatches', () => {
  it('keeps live sidebar share reads within the backend request cap', () => {
    const itemIds = Array.from(
      { length: 101 },
      (_, index) => `note_${index + 1}` as Id<'sidebarItems'>,
    )

    expect(createSidebarShareQueryItemIdBatches(itemIds)).toEqual([
      itemIds.slice(0, 100),
      [itemIds[100]],
    ])
  })
})
