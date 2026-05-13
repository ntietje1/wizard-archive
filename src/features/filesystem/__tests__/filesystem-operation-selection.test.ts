import { describe, expect, it } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { SIDEBAR_ITEM_STATUS } from 'convex/sidebarItems/types/baseTypes'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import {
  resolveClickedSidebarOperationItems,
  resolveSidebarOperationItems,
} from '../filesystem-operation-selection'

describe('filesystem operation selection', () => {
  it('prunes stale selected ids instead of rejecting the whole operation', () => {
    const item = createNote()
    const stale = createNote()

    const items = resolveClickedSidebarOperationItems({
      item,
      selectedItemIds: [item._id, stale._id],
      activeItemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>([[item._id, item]]),
      trashedItemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>(),
      canUseItemSelection: true,
    })

    expect(items).toEqual([item])
  })

  it('falls back to the clicked item when the clicked item is outside the selection', () => {
    const clicked = createNote()
    const selected = createNote()

    const items = resolveClickedSidebarOperationItems({
      item: clicked,
      selectedItemIds: [selected._id],
      activeItemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>([
        [clicked._id, clicked],
        [selected._id, selected],
      ]),
      trashedItemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>(),
      canUseItemSelection: true,
    })

    expect(items).toEqual([clicked])
  })

  it('uses only the clicked item when selection cannot be used', () => {
    const clicked = createNote()
    const selected = createNote()

    const items = resolveClickedSidebarOperationItems({
      item: clicked,
      selectedItemIds: [clicked._id, selected._id],
      activeItemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>([
        [clicked._id, clicked],
        [selected._id, selected],
      ]),
      trashedItemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>(),
      canUseItemSelection: false,
    })

    expect(items).toEqual([clicked])
  })

  it('uses clicked trash items when selection cannot be used', () => {
    const clicked = createNote({ status: SIDEBAR_ITEM_STATUS.trashed })
    const selected = createNote()

    const items = resolveClickedSidebarOperationItems({
      item: clicked,
      selectedItemIds: [clicked._id, selected._id],
      activeItemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>([[selected._id, selected]]),
      trashedItemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>([[clicked._id, clicked]]),
      canUseItemSelection: false,
    })

    expect(items).toEqual([clicked])
  })

  it('ignores trashed selected items by default', () => {
    const active = createNote()
    const trashed = createNote({ status: SIDEBAR_ITEM_STATUS.trashed })

    const items = resolveSidebarOperationItems({
      itemIds: [active._id, trashed._id],
      activeItemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>([[active._id, active]]),
      trashedItemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>([[trashed._id, trashed]]),
      includeTrashed: false,
    })

    expect(items).toEqual([active])
  })

  it('normalizes selected descendants under selected folder roots', () => {
    const folder = createFolder()
    const child = createNote({ parentId: folder._id })

    const items = resolveSidebarOperationItems({
      itemIds: [folder._id, child._id],
      activeItemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>([
        [folder._id, folder],
        [child._id, child],
      ]),
    })

    expect(items).toEqual([folder])
  })

  it('normalizes multi-level selected descendants under the top folder root', () => {
    const folder = createFolder()
    const subfolder = createFolder({ parentId: folder._id })
    const note = createNote({ parentId: subfolder._id })

    const items = resolveSidebarOperationItems({
      itemIds: [folder._id, subfolder._id, note._id],
      activeItemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>([
        [folder._id, folder],
        [subfolder._id, subfolder],
        [note._id, note],
      ]),
    })

    expect(items).toEqual([folder])
  })
})
