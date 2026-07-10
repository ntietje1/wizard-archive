import { describe, expect, it } from 'vite-plus/test'
import { RESOURCE_TYPES } from '../../../workspace/items-persistence-contract'
import { collectDescendantIdsFromItems } from '../tree'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import { createSidebarItem } from './test-sidebar-item'

describe('collectDescendantIdsFromItems', () => {
  it('returns an empty set for a folder with no descendants', () => {
    const root = createSidebarItem('folder_1', 'Folder 1', RESOURCE_TYPES.folders)

    expect(collectDescendantIdsFromItems(root.id, [root])).toEqual(new Set())
  })

  it('collects nested descendants', () => {
    const root = createSidebarItem('folder_1', 'Folder 1', RESOURCE_TYPES.folders)
    const childFolder = createSidebarItem('folder_2', 'Folder 2', RESOURCE_TYPES.folders, {
      parentId: root.id,
    })
    const leaf = createSidebarItem('note_1', 'Note 1', RESOURCE_TYPES.notes, {
      parentId: childFolder.id,
    })

    expect(collectDescendantIdsFromItems(root.id, [root, childFolder, leaf])).toEqual(
      new Set([childFolder.id, leaf.id]),
    )
  })

  it('collects descendants from multiple branches', () => {
    const root = createSidebarItem('folder_1', 'Folder 1', RESOURCE_TYPES.folders)
    const childFolderA = createSidebarItem('folder_2', 'Folder 2', RESOURCE_TYPES.folders, {
      parentId: root.id,
    })
    const childFolderB = createSidebarItem('folder_3', 'Folder 3', RESOURCE_TYPES.folders, {
      parentId: root.id,
    })
    const leafA = createSidebarItem('note_1', 'Note 1', RESOURCE_TYPES.notes, {
      parentId: childFolderA.id,
    })
    const leafB = createSidebarItem('note_2', 'Note 2', RESOURCE_TYPES.notes, {
      parentId: childFolderB.id,
    })

    expect(
      collectDescendantIdsFromItems(root.id, [root, childFolderA, childFolderB, leafA, leafB]),
    ).toEqual(new Set([childFolderA.id, childFolderB.id, leafA.id, leafB.id]))
  })

  it('throws when a cycle reaches the root folder', () => {
    const root = createSidebarItem('folder_1', 'Folder 1', RESOURCE_TYPES.folders, {
      parentId: 'folder_2' as SidebarItemId,
    })
    const childFolder = createSidebarItem('folder_2', 'Folder 2', RESOURCE_TYPES.folders, {
      parentId: root.id,
    })

    expect(() => collectDescendantIdsFromItems(root.id, [root, childFolder])).toThrow(
      'appears as its own descendant',
    )
  })

  it('throws when a non-root cycle appears in descendants', () => {
    const root = createSidebarItem('folder_1', 'Folder 1', RESOURCE_TYPES.folders)
    const folderA = createSidebarItem('folder_2', 'Folder 2', RESOURCE_TYPES.folders, {
      parentId: root.id,
    })
    const folderB = createSidebarItem('folder_3', 'Folder 3', RESOURCE_TYPES.folders, {
      parentId: folderA.id,
    })
    const folderAInCycle = createSidebarItem(folderA.id, 'Folder 2', RESOURCE_TYPES.folders, {
      parentId: folderB.id,
    })

    expect(() =>
      collectDescendantIdsFromItems(root.id, [root, folderA, folderB, folderAInCycle]),
    ).toThrow('appears as its own descendant')
  })

  it('throws when maxDepth is less than one', () => {
    const root = createSidebarItem('folder_1', 'Folder 1', RESOURCE_TYPES.folders)

    expect(() => collectDescendantIdsFromItems(root.id, [root], { maxDepth: 0 })).toThrow(
      'maxDepth must be an integer greater than or equal to 1',
    )
  })

  it('throws when maxDepth is negative', () => {
    const root = createSidebarItem('folder_1', 'Folder 1', RESOURCE_TYPES.folders)

    expect(() => collectDescendantIdsFromItems(root.id, [root], { maxDepth: -1 })).toThrow(
      'maxDepth must be an integer greater than or equal to 1',
    )
  })

  it('throws when maxDepth is not an integer', () => {
    const root = createSidebarItem('folder_1', 'Folder 1', RESOURCE_TYPES.folders)

    expect(() => collectDescendantIdsFromItems(root.id, [root], { maxDepth: 1.5 })).toThrow(
      'maxDepth must be an integer greater than or equal to 1',
    )
  })

  it('allows traversal when maxDepth equals the deepest descendant folder depth', () => {
    const root = createSidebarItem('folder_1', 'Folder 1', RESOURCE_TYPES.folders)
    const childFolder = createSidebarItem('folder_2', 'Folder 2', RESOURCE_TYPES.folders, {
      parentId: root.id,
    })
    const leaf = createSidebarItem('note_1', 'Note 1', RESOURCE_TYPES.notes, {
      parentId: childFolder.id,
    })

    expect(
      collectDescendantIdsFromItems(root.id, [root, childFolder, leaf], { maxDepth: 1 }),
    ).toEqual(new Set([childFolder.id, leaf.id]))
  })

  it('allows traversal when maxDepth exceeds the tree depth', () => {
    const root = createSidebarItem('folder_1', 'Folder 1', RESOURCE_TYPES.folders)
    const childFolder = createSidebarItem('folder_2', 'Folder 2', RESOURCE_TYPES.folders, {
      parentId: root.id,
    })
    const leaf = createSidebarItem('note_1', 'Note 1', RESOURCE_TYPES.notes, {
      parentId: childFolder.id,
    })

    expect(
      collectDescendantIdsFromItems(root.id, [root, childFolder, leaf], { maxDepth: 2 }),
    ).toEqual(new Set([childFolder.id, leaf.id]))
  })

  it('throws when max depth is exceeded', () => {
    const root = createSidebarItem('folder_1', 'Folder 1', RESOURCE_TYPES.folders)
    const childFolder = createSidebarItem('folder_2', 'Folder 2', RESOURCE_TYPES.folders, {
      parentId: root.id,
    })
    const grandchildFolder = createSidebarItem('folder_3', 'Folder 3', RESOURCE_TYPES.folders, {
      parentId: childFolder.id,
    })

    expect(() =>
      collectDescendantIdsFromItems(root.id, [root, childFolder, grandchildFolder], {
        maxDepth: 1,
      }),
    ).toThrow('Max sidebar tree depth exceeded')
  })

  it('throws when the root folder is missing from the item list', () => {
    const root = createSidebarItem('folder_1', 'Folder 1', RESOURCE_TYPES.folders)

    expect(() => collectDescendantIdsFromItems(root.id, [])).toThrow(
      `Folder ${root.id} was not found while collecting descendants`,
    )
  })
})
