import { describe, expect, it } from 'vitest'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { resolveNormalizedDraggedSidebarItems } from '~/features/dnd/utils/sidebar-drag-items'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'

function itemMap(items: Array<AnySidebarItem>) {
  return new Map<Id<'sidebarItems'>, AnySidebarItem>(items.map((item) => [item._id, item]))
}

describe('resolveNormalizedDraggedSidebarItems', () => {
  it('collapses dragged descendants under selected ancestor roots', () => {
    const folder = createFolder()
    const child = createNote({ parentId: folder._id })

    const items = resolveNormalizedDraggedSidebarItems({
      sourceData: { sidebarItemIds: [folder._id, child._id] },
      activeItemsMap: itemMap([folder, child]),
    })

    expect(items).toEqual([folder])
  })

  it('skips trashed items unless requested', () => {
    const active = createNote()
    const trashed = createNote({ location: SIDEBAR_ITEM_LOCATION.trash })

    const items = resolveNormalizedDraggedSidebarItems({
      sourceData: { sidebarItemIds: [active._id, trashed._id] },
      activeItemsMap: itemMap([active]),
      trashedItemsMap: itemMap([trashed]),
    })

    expect(items).toEqual([active])
  })

  it('can include trashed items for move and restore decisions', () => {
    const trashed = createNote({ location: SIDEBAR_ITEM_LOCATION.trash })

    const items = resolveNormalizedDraggedSidebarItems({
      sourceData: { sidebarItemIds: [trashed._id] },
      activeItemsMap: itemMap([]),
      trashedItemsMap: itemMap([trashed]),
      includeTrashed: true,
    })

    expect(items).toEqual([trashed])
  })

  it('excludes target-specific ids before normalization', () => {
    const folder = createFolder()
    const child = createNote({ parentId: folder._id })

    const items = resolveNormalizedDraggedSidebarItems({
      sourceData: { sidebarItemIds: [folder._id, child._id] },
      activeItemsMap: itemMap([folder, child]),
      excludeItemIds: [folder._id],
    })

    expect(items).toEqual([child])
  })
})
