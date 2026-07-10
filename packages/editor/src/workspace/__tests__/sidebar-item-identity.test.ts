import { describe, expect, it } from 'vite-plus/test'
import { createNote } from '../../test/sidebar-item-factory'
import { isPersistedResourceItem, isPersistedResourceItemId } from '../items'
import { isOptimisticSidebarItem, isOptimisticSidebarItemId } from '../items/optimistic'
import type { SidebarItemId } from '../../../../../shared/common/ids'

describe('sidebar item identity', () => {
  it('partitions persisted items and optimistic editor placeholders by id', () => {
    const persistedItem = createNote({
      id: 'persisted-note' as SidebarItemId,
    })
    const optimisticItem = createNote({
      id: 'optimistic-create-1' as SidebarItemId,
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
