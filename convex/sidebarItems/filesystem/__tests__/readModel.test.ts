import { describe, expect, it } from 'vitest'
import { SIDEBAR_ITEM_STATUS, SIDEBAR_ITEM_TYPES } from '../../../../shared/sidebar-items/types'
import { createFileSystemReadModel } from '../../../../shared/sidebar-items/filesystem/read-model'
import { createSidebarItem } from '../../../_test/sidebarItem.helper'
import type { Id } from '../../../_generated/dataModel'

describe('filesystem read model', () => {
  it('indexes items by id and slug', () => {
    const note = createSidebarItem('note-1', 'Note')
    const model = createFileSystemReadModel([note])

    expect(model.getItem(note._id)).toBe(note)
    expect(model.getItemBySlug(note.slug)).toBe(note)
  })

  it('throws when duplicate ids are supplied', () => {
    const first = createSidebarItem('note-1', 'First')
    const second = createSidebarItem('note-1', 'Second')

    expect(() => createFileSystemReadModel([first, second])).toThrow(/Duplicate sidebar item id/)
  })

  it('throws when duplicate slugs are supplied', () => {
    const first = createSidebarItem('note-1', 'Same')
    const second = createSidebarItem('note-2', 'Same')

    expect(() => createFileSystemReadModel([first, second])).toThrow(/Duplicate sidebar item slug/)
  })

  it('indexes active children only', () => {
    const folder = createSidebarItem('folder-1', 'Folder', SIDEBAR_ITEM_TYPES.folders)
    const activeChild = createSidebarItem('note-1', 'Active', SIDEBAR_ITEM_TYPES.notes, {
      parentId: folder._id,
    })
    const trashedChild = createSidebarItem('note-2', 'Trashed', SIDEBAR_ITEM_TYPES.notes, {
      parentId: folder._id,
      status: SIDEBAR_ITEM_STATUS.trashed,
      isActive: false,
      isTrashed: true,
    })
    const model = createFileSystemReadModel([folder, activeChild, trashedChild])

    expect(model.getActiveChildren(folder._id)).toEqual([activeChild])
  })

  it('returns loaded items and throws for missing required items', () => {
    const first = createSidebarItem('note-1', 'First')
    const second = createSidebarItem('note-2', 'Second')
    const missingId = 'missing' as Id<'sidebarItems'>
    const model = createFileSystemReadModel([first, second])

    expect(model.getItems([first._id, missingId, second._id])).toEqual([first, second])
    expect(() => model.requireItems([first._id, missingId])).toThrow(/missing sidebar items/)
  })
})
