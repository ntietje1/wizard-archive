import { describe, expect, it } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { resolveContextSelectedItems } from '~/features/context-menu/selection-context'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'

describe('resolveContextSelectedItems', () => {
  it('falls back to the clicked item when selection is not usable', () => {
    const item = createNote()

    const selectedItems = resolveContextSelectedItems({
      item,
      selectedItemIds: [item._id],
      activeItemsMap: new Map(),
      trashedItemsMap: new Map(),
      canUseItemSelection: false,
    })

    expect(selectedItems).toEqual([item])
  })

  it('resolves and normalizes selected roots', () => {
    const folder = createFolder()
    const child = createNote({ parentId: folder._id })
    const selectedItems = resolveContextSelectedItems({
      item: child,
      selectedItemIds: [folder._id, child._id],
      activeItemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>([
        [folder._id, folder],
        [child._id, child],
      ]),
      trashedItemsMap: new Map(),
      canUseItemSelection: true,
    })

    expect(selectedItems).toEqual([folder])
  })
})
