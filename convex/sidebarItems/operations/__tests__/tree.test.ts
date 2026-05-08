import { describe, expect, it } from 'vitest'
import { SIDEBAR_ITEM_TYPES } from '../../types/baseTypes'
import { collectDescendantIdsFromItems } from '../tree'
import type { Id } from '../../../_generated/dataModel'
import type { SidebarItemType } from '../../types/baseTypes'

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
  it('collects nested descendants', () => {
    const root = item('folder_1', null, SIDEBAR_ITEM_TYPES.folders)
    const childFolder = item('folder_2', root._id, SIDEBAR_ITEM_TYPES.folders)
    const leaf = item('note_1', childFolder._id)

    expect(collectDescendantIdsFromItems(root._id, [root, childFolder, leaf])).toEqual(
      new Set([childFolder._id, leaf._id]),
    )
  })

  it('throws when a cycle reaches the root folder', () => {
    const root = item('folder_1', 'folder_2' as Id<'sidebarItems'>, SIDEBAR_ITEM_TYPES.folders)
    const childFolder = item('folder_2', root._id, SIDEBAR_ITEM_TYPES.folders)

    expect(() => collectDescendantIdsFromItems(root._id, [root, childFolder])).toThrow(
      'Cycle detected',
    )
  })

  it('throws when max depth is exceeded', () => {
    const root = item('folder_1', null, SIDEBAR_ITEM_TYPES.folders)
    const childFolder = item('folder_2', root._id, SIDEBAR_ITEM_TYPES.folders)
    const leaf = item('note_1', childFolder._id)

    expect(() =>
      collectDescendantIdsFromItems(root._id, [root, childFolder, leaf], { maxDepth: 1 }),
    ).toThrow('Max sidebar tree depth exceeded')
  })
})
