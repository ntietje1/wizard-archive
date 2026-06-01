import { describe, expect, it } from 'vitest'
import { SIDEBAR_ITEM_TYPES } from '../../../../shared/sidebar-items/types'
import { collectDescendantIdsFromItems } from '../../../../shared/sidebar-items/filesystem/tree'
import type { Id } from '../../../_generated/dataModel'
import type { SidebarItemType } from '../../../../shared/sidebar-items/types'

function item(
  id: string,
  parentId: Id<'sidebarItems'> | null,
  type: SidebarItemType = SIDEBAR_ITEM_TYPES.notes,
) {
  return {
    _id: id as Id<'sidebarItems'>,
    parentId,
    type,
  }
}

describe('collectDescendantIdsFromItems', () => {
  it('returns an empty set for a folder with no descendants', () => {
    const root = item('folder_1', null, SIDEBAR_ITEM_TYPES.folders)

    expect(collectDescendantIdsFromItems(root._id, [root])).toEqual(new Set())
  })

  it('collects nested descendants', () => {
    const root = item('folder_1', null, SIDEBAR_ITEM_TYPES.folders)
    const childFolder = item('folder_2', root._id, SIDEBAR_ITEM_TYPES.folders)
    const leaf = item('note_1', childFolder._id)

    expect(collectDescendantIdsFromItems(root._id, [root, childFolder, leaf])).toEqual(
      new Set([childFolder._id, leaf._id]),
    )
  })

  it('collects descendants from multiple branches', () => {
    const root = item('folder_1', null, SIDEBAR_ITEM_TYPES.folders)
    const childFolderA = item('folder_2', root._id, SIDEBAR_ITEM_TYPES.folders)
    const childFolderB = item('folder_3', root._id, SIDEBAR_ITEM_TYPES.folders)
    const leafA = item('note_1', childFolderA._id)
    const leafB = item('note_2', childFolderB._id)

    expect(
      collectDescendantIdsFromItems(root._id, [root, childFolderA, childFolderB, leafA, leafB]),
    ).toEqual(new Set([childFolderA._id, childFolderB._id, leafA._id, leafB._id]))
  })

  it('throws when a cycle reaches the root folder', () => {
    const root = item('folder_1', 'folder_2' as Id<'sidebarItems'>, SIDEBAR_ITEM_TYPES.folders)
    const childFolder = item('folder_2', root._id, SIDEBAR_ITEM_TYPES.folders)

    expect(() => collectDescendantIdsFromItems(root._id, [root, childFolder])).toThrow(
      'appears as its own descendant',
    )
  })

  it('throws when a non-root cycle appears in descendants', () => {
    const folderA = item('folder_2', 'folder_3' as Id<'sidebarItems'>, SIDEBAR_ITEM_TYPES.folders)
    const folderB = item('folder_3', folderA._id, SIDEBAR_ITEM_TYPES.folders)

    expect(() => collectDescendantIdsFromItems(folderA._id, [folderA, folderB])).toThrow(
      'appears as its own descendant',
    )
  })

  it('throws when maxDepth is less than one', () => {
    const root = item('folder_1', null, SIDEBAR_ITEM_TYPES.folders)

    expect(() => collectDescendantIdsFromItems(root._id, [root], { maxDepth: 0 })).toThrow(
      'maxDepth must be an integer greater than or equal to 1',
    )
  })

  it('throws when maxDepth is negative', () => {
    const root = item('folder_1', null, SIDEBAR_ITEM_TYPES.folders)

    expect(() => collectDescendantIdsFromItems(root._id, [root], { maxDepth: -1 })).toThrow(
      'maxDepth must be an integer greater than or equal to 1',
    )
  })

  it('throws when maxDepth is not an integer', () => {
    const root = item('folder_1', null, SIDEBAR_ITEM_TYPES.folders)

    expect(() => collectDescendantIdsFromItems(root._id, [root], { maxDepth: 1.5 })).toThrow(
      'maxDepth must be an integer greater than or equal to 1',
    )
  })

  it('allows traversal when maxDepth equals the deepest descendant folder depth', () => {
    const root = item('folder_1', null, SIDEBAR_ITEM_TYPES.folders)
    const childFolder = item('folder_2', root._id, SIDEBAR_ITEM_TYPES.folders)
    const leaf = item('note_1', childFolder._id)

    expect(
      collectDescendantIdsFromItems(root._id, [root, childFolder, leaf], { maxDepth: 1 }),
    ).toEqual(new Set([childFolder._id, leaf._id]))
  })

  it('allows traversal when maxDepth exceeds the tree depth', () => {
    const root = item('folder_1', null, SIDEBAR_ITEM_TYPES.folders)
    const childFolder = item('folder_2', root._id, SIDEBAR_ITEM_TYPES.folders)
    const leaf = item('note_1', childFolder._id)

    expect(
      collectDescendantIdsFromItems(root._id, [root, childFolder, leaf], { maxDepth: 2 }),
    ).toEqual(new Set([childFolder._id, leaf._id]))
  })

  it('throws when max depth is exceeded', () => {
    const root = item('folder_1', null, SIDEBAR_ITEM_TYPES.folders)
    const childFolder = item('folder_2', root._id, SIDEBAR_ITEM_TYPES.folders)
    const grandchildFolder = item('folder_3', childFolder._id, SIDEBAR_ITEM_TYPES.folders)

    expect(() =>
      collectDescendantIdsFromItems(root._id, [root, childFolder, grandchildFolder], {
        maxDepth: 1,
      }),
    ).toThrow('Max sidebar tree depth exceeded')
  })

  it('throws when the root folder is missing from the item list', () => {
    const root = item('folder_1', null, SIDEBAR_ITEM_TYPES.folders)

    expect(() => collectDescendantIdsFromItems(root._id, [])).toThrow(
      `Folder ${root._id} was not found while collecting descendants`,
    )
  })
})
