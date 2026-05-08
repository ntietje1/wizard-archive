import { describe, expect, it } from 'vitest'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
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
      activeItemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>(),
      trashedItemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>(),
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
      trashedItemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>(),
      canUseItemSelection: true,
    })

    expect(selectedItems).toEqual([folder])
  })

  it('keeps a selected child when its parent is not selected', () => {
    const folder = createFolder()
    const child = createNote({ parentId: folder._id })

    const selectedItems = resolveContextSelectedItems({
      item: child,
      selectedItemIds: [child._id],
      activeItemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>([
        [folder._id, folder],
        [child._id, child],
      ]),
      trashedItemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>(),
      canUseItemSelection: true,
    })

    expect(selectedItems).toEqual([child])
  })

  it('resolves multiple unrelated active items in selection order', () => {
    const note = createNote()
    const folder = createFolder()

    const selectedItems = resolveContextSelectedItems({
      item: folder,
      selectedItemIds: [note._id, folder._id],
      activeItemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>([
        [note._id, note],
        [folder._id, folder],
      ]),
      trashedItemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>(),
      canUseItemSelection: true,
    })

    expect(selectedItems).toEqual([note, folder])
  })

  it('falls back to the clicked item when it is not in the current selection', () => {
    const clicked = createNote()
    const selected = createNote()

    const selectedItems = resolveContextSelectedItems({
      item: clicked,
      selectedItemIds: [selected._id],
      activeItemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>([
        [clicked._id, clicked],
        [selected._id, selected],
      ]),
      trashedItemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>(),
      canUseItemSelection: true,
    })

    expect(selectedItems).toEqual([clicked])
  })

  it('resolves selected trash items from the trash map', () => {
    const trashed = createNote({ location: SIDEBAR_ITEM_LOCATION.trash })

    const selectedItems = resolveContextSelectedItems({
      item: trashed,
      selectedItemIds: [trashed._id],
      activeItemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>(),
      trashedItemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>([[trashed._id, trashed]]),
      canUseItemSelection: true,
    })

    expect(selectedItems).toEqual([trashed])
  })
})
