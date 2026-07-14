import type { ResourceId } from '../../resources/domain-id'
import { describe, expect, it } from 'vite-plus/test'
import { createNote } from '../../test/sidebar-item-factory'
import { isPersistedResourceItem, isPersistedResourceItemId } from '../items'
import { isOptimisticSidebarItem, isOptimisticSidebarItemId } from '../items/optimistic'

describe('sidebar item identity', () => {
  it('partitions persisted items and optimistic editor placeholders by id', () => {
    const persistedItem = createNote({
      id: 'persisted-note' as ResourceId,
    })
    const optimisticItem = createNote({
      id: 'optimistic-create-1' as ResourceId,
    })

    const items = [persistedItem, optimisticItem]
    const itemIds = items.map((item) => item.id)

    expect(items.filter(isPersistedResourceItem).map((item) => item.id)).toEqual([persistedItem.id])
    expect(itemIds.filter(isPersistedResourceItemId)).toEqual([persistedItem.id])
    expect(items.filter(isOptimisticSidebarItem).map((item) => item.id)).toEqual([
      optimisticItem.id,
    ])
    expect(itemIds.filter(isOptimisticSidebarItemId)).toEqual([optimisticItem.id])
  })
})
