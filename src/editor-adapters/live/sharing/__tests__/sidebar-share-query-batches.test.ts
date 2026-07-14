import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { describe, expect, it } from 'vite-plus/test'
import { createSidebarShareQueryItemIdBatches } from '../sidebar-share-query-batches'

describe('createSidebarShareQueryItemIdBatches', () => {
  it('keeps live sidebar share reads within the backend request cap', () => {
    const itemIds = Array.from({ length: 101 }, (_, index) => `note_${index + 1}` as ResourceId)

    expect(createSidebarShareQueryItemIdBatches(itemIds)).toEqual([
      itemIds.slice(0, 100),
      [itemIds[100]],
    ])
  })
})
