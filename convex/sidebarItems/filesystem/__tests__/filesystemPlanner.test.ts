import { describe, expect, it } from 'vitest'
import { SIDEBAR_ITEM_TYPES } from '../../types/baseTypes'
import { PERMISSION_LEVEL } from '../../../permissions/types'
import { planCopyOperations } from '../copyPlanner'
import { planMoveOperations } from '../movePlanner'
import type { ConflictDecision } from '../operationTypes'
import type { AnySidebarItem } from '../../types/types'
import type { Id } from '../../../_generated/dataModel'

function item(
  id: string,
  name: string,
  type: AnySidebarItem['type'] = SIDEBAR_ITEM_TYPES.notes,
  overrides: Partial<AnySidebarItem> = {},
): AnySidebarItem {
  return {
    _id: id as Id<'sidebarItems'>,
    _creationTime: 1,
    name: name as AnySidebarItem['name'],
    slug: name.toLowerCase() as AnySidebarItem['slug'],
    campaignId: 'campaign' as Id<'campaigns'>,
    iconName: null,
    color: null,
    type,
    parentId: null,
    allPermissionLevel: null,
    status: 'active',
    previewStorageId: null,
    previewLockedUntil: null,
    previewClaimToken: null,
    previewUpdatedAt: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: 'user' as Id<'userProfiles'>,
    deletionTime: null,
    deletedBy: null,
    shares: [],
    isBookmarked: false,
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    previewUrl: null,
    ...overrides,
  } as AnySidebarItem
}

function decisions(values: Record<string, ConflictDecision>) {
  return values as Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
}

describe('planCopyOperations', () => {
  it('returns no operations for empty inputs', () => {
    expect(
      planCopyOperations({
        items: [],
        targetParentId: null,
        targetItems: [],
      }),
    ).toEqual({ status: 'ready', conflicts: [], operations: [] })
  })

  it('returns a conflict when an incoming item matches a destination sibling name', () => {
    const result = planCopyOperations({
      items: [item('note-1', 'Scene')],
      targetParentId: null,
      targetItems: [item('note-2', 'Scene')],
    })

    expect(result.status).toBe('needs-decision')
    expect(result.conflicts).toMatchObject([
      {
        sourceItemId: 'note-1',
        destinationItemId: 'note-2',
        sourceName: 'Scene',
        destinationName: 'Scene',
        kind: 'name-conflict',
      },
    ])
  })

  it('maps keep-both conflicts to copy operations with deduplicated names', () => {
    const result = planCopyOperations({
      items: [item('note-1', 'Scene')],
      targetParentId: null,
      targetItems: [item('note-2', 'Scene'), item('note-3', 'Scene 2')],
      decisions: decisions({ 'note-1': { action: 'keepBoth' } }),
    })

    expect(result.status).toBe('ready')
    expect(result.operations).toEqual([
      { sourceItemId: 'note-1', action: 'copy', targetParentId: null, name: 'Scene 3' },
    ])
  })

  it('auto keeps both when duplicating an item into its current parent', () => {
    const source = item('note-1', 'Scene')
    const result = planCopyOperations({
      items: [source],
      targetParentId: null,
      targetItems: [source, item('note-2', 'Scene 2')],
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        { sourceItemId: 'note-1', action: 'copy', targetParentId: null, name: 'Scene 3' },
      ],
    })
  })

  it('maps replace to replace for files and mergeFolder for folders', () => {
    const fileResult = planCopyOperations({
      items: [item('file-1', 'Handout', SIDEBAR_ITEM_TYPES.files)],
      targetParentId: null,
      targetItems: [item('file-2', 'Handout', SIDEBAR_ITEM_TYPES.files)],
      decisions: decisions({ 'file-1': { action: 'replace' } }),
    })
    const folderResult = planCopyOperations({
      items: [item('folder-1', 'Locations', SIDEBAR_ITEM_TYPES.folders)],
      targetParentId: null,
      targetItems: [item('folder-2', 'Locations', SIDEBAR_ITEM_TYPES.folders)],
      decisions: decisions({ 'folder-1': { action: 'replace' } }),
    })

    expect(fileResult.operations).toEqual([
      {
        sourceItemId: 'file-1',
        action: 'replace',
        targetParentId: null,
        destinationItemId: 'file-2',
        name: 'Handout',
      },
    ])
    expect(folderResult.operations).toEqual([
      {
        sourceItemId: 'folder-1',
        action: 'mergeFolder',
        targetParentId: null,
        destinationItemId: 'folder-2',
      },
    ])
  })

  it('propagates folder replace decisions to descendant duplicate conflicts', () => {
    const sourceFolder = item('folder-1', 'Scenes', SIDEBAR_ITEM_TYPES.folders)
    const destinationFolder = item('folder-2', 'Scenes', SIDEBAR_ITEM_TYPES.folders)
    const sourceChild = item('note-1', 'Ambush', SIDEBAR_ITEM_TYPES.notes, {
      parentId: sourceFolder._id,
    })
    const destinationChild = item('note-2', 'Ambush', SIDEBAR_ITEM_TYPES.notes, {
      parentId: destinationFolder._id,
    })

    const result = planCopyOperations({
      items: [sourceFolder],
      targetParentId: null,
      targetItems: [destinationFolder],
      decisions: decisions({ 'folder-1': { action: 'replace' } }),
      getChildren: (parentId) => {
        if (parentId === sourceFolder._id) return [sourceChild]
        if (parentId === destinationFolder._id) return [destinationChild]
        return []
      },
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        {
          sourceItemId: sourceChild._id,
          action: 'replace',
          targetParentId: destinationFolder._id,
          destinationItemId: destinationChild._id,
          name: 'Ambush',
        },
        {
          sourceItemId: sourceFolder._id,
          action: 'mergeFolder',
          targetParentId: null,
          destinationItemId: destinationFolder._id,
        },
      ],
    })
  })

  it('supports skip decisions', () => {
    const skipResult = planCopyOperations({
      items: [item('note-1', 'Scene')],
      targetParentId: null,
      targetItems: [item('note-2', 'Scene')],
      decisions: decisions({ 'note-1': { action: 'skip' } }),
    })

    expect(skipResult).toMatchObject({ status: 'ready', operations: [] })
  })

  it('ignores descendants when an ancestor folder is also selected', () => {
    const sourceFolder = item('folder-1', 'Scenes', SIDEBAR_ITEM_TYPES.folders)
    const sourceChild = item('note-1', 'Ambush', SIDEBAR_ITEM_TYPES.notes, {
      parentId: sourceFolder._id,
    })

    const result = planCopyOperations({
      items: [sourceFolder, sourceChild],
      targetParentId: null,
      targetItems: [],
      getChildren: (parentId) => (parentId === sourceFolder._id ? [sourceChild] : []),
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        {
          sourceItemId: sourceFolder._id,
          action: 'copy',
          targetParentId: null,
          name: 'Scenes',
        },
      ],
    })
  })

  it('surfaces multiple unresolved duplicate conflicts together', () => {
    const result = planCopyOperations({
      items: [item('note-1', 'Scene'), item('note-2', 'Clue')],
      targetParentId: null,
      targetItems: [item('note-3', 'Scene'), item('note-4', 'Clue')],
    })

    expect(result.status).toBe('needs-decision')
    expect(result.conflicts.map((conflict) => conflict.sourceItemId)).toEqual(['note-1', 'note-2'])
  })
})

describe('planMoveOperations', () => {
  it('returns no operations for empty inputs', () => {
    expect(
      planMoveOperations({
        items: [],
        targetParentId: null,
        targetItems: [],
      }),
    ).toEqual({ status: 'ready', conflicts: [], operations: [] })
  })

  it('detects move conflicts before producing destructive operations', () => {
    const source = item('note-1', 'Scene', SIDEBAR_ITEM_TYPES.notes, {
      parentId: 'source-folder' as Id<'sidebarItems'>,
    })
    const destination = item('note-2', 'Scene')
    const result = planMoveOperations({
      items: [source],
      targetParentId: null,
      targetItems: [destination],
    })

    expect(result.status).toBe('needs-decision')
    expect(result.conflicts).toEqual([
      expect.objectContaining({
        sourceItemId: 'note-1',
        destinationItemId: 'note-2',
      }),
    ])
  })

  it('renames incoming move operations when keeping both', () => {
    const result = planMoveOperations({
      items: [
        item('note-1', 'Scene', SIDEBAR_ITEM_TYPES.notes, {
          parentId: 'source-folder' as Id<'sidebarItems'>,
        }),
      ],
      targetParentId: null,
      targetItems: [item('note-2', 'Scene'), item('note-3', 'Scene 2')],
      decisions: decisions({ 'note-1': { action: 'keepBoth' } }),
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        { sourceItemId: 'note-1', action: 'move', targetParentId: null, name: 'Scene 3' },
      ],
    })
  })

  it('renames later incoming items that collide with earlier incoming names', () => {
    const result = planMoveOperations({
      items: [
        item('note-1', 'Scene', SIDEBAR_ITEM_TYPES.notes, {
          parentId: 'source-folder-a' as Id<'sidebarItems'>,
        }),
        item('note-2', 'Scene', SIDEBAR_ITEM_TYPES.notes, {
          parentId: 'source-folder-b' as Id<'sidebarItems'>,
        }),
      ],
      targetParentId: null,
      targetItems: [],
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        { sourceItemId: 'note-1', action: 'move', targetParentId: null },
        { sourceItemId: 'note-2', action: 'move', targetParentId: null, name: 'Scene 2' },
      ],
    })
  })

  it('deduplicates repeated selected sources', () => {
    const source = item('note-1', 'Scene', SIDEBAR_ITEM_TYPES.notes, {
      parentId: 'source-root' as Id<'sidebarItems'>,
    })

    const result = planMoveOperations({
      items: [source, source],
      targetParentId: null,
      targetItems: [],
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [{ sourceItemId: source._id, action: 'move', targetParentId: null }],
    })
  })

  it('propagates folder replace decisions to descendant move conflicts', () => {
    const sourceFolder = item('folder-1', 'Scenes', SIDEBAR_ITEM_TYPES.folders, {
      parentId: 'source-root' as Id<'sidebarItems'>,
    })
    const destinationFolder = item('folder-2', 'Scenes', SIDEBAR_ITEM_TYPES.folders)
    const sourceChild = item('note-1', 'Ambush', SIDEBAR_ITEM_TYPES.notes, {
      parentId: sourceFolder._id,
    })
    const destinationChild = item('note-2', 'Ambush', SIDEBAR_ITEM_TYPES.notes, {
      parentId: destinationFolder._id,
    })

    const result = planMoveOperations({
      items: [sourceFolder],
      targetParentId: null,
      targetItems: [destinationFolder],
      decisions: decisions({ 'folder-1': { action: 'replace' } }),
      getChildren: (parentId) => {
        if (parentId === sourceFolder._id) return [sourceChild]
        if (parentId === destinationFolder._id) return [destinationChild]
        return []
      },
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        {
          sourceItemId: sourceChild._id,
          action: 'replace',
          targetParentId: destinationFolder._id,
          destinationItemId: destinationChild._id,
          name: 'Ambush',
        },
        {
          sourceItemId: sourceFolder._id,
          action: 'mergeFolder',
          targetParentId: null,
          destinationItemId: destinationFolder._id,
        },
      ],
    })
  })

  it('moves resolved folder merge children before cleaning up the source folder', () => {
    const sourceFolder = item('folder-1', 'Scenes', SIDEBAR_ITEM_TYPES.folders, {
      parentId: 'source-root' as Id<'sidebarItems'>,
    })
    const destinationFolder = item('folder-2', 'Scenes', SIDEBAR_ITEM_TYPES.folders)
    const sourceChild = item('note-1', 'Ambush', SIDEBAR_ITEM_TYPES.notes, {
      parentId: sourceFolder._id,
    })
    const destinationChild = item('note-2', 'Ambush', SIDEBAR_ITEM_TYPES.notes, {
      parentId: destinationFolder._id,
    })

    const result = planMoveOperations({
      items: [sourceFolder],
      targetParentId: null,
      targetItems: [destinationFolder],
      decisions: decisions({
        'folder-1': { action: 'replace' },
        'note-1': { action: 'keepBoth' },
      }),
      getChildren: (parentId) => {
        if (parentId === sourceFolder._id) return [sourceChild]
        if (parentId === destinationFolder._id) return [destinationChild]
        return []
      },
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        {
          sourceItemId: sourceChild._id,
          action: 'move',
          targetParentId: destinationFolder._id,
          name: 'Ambush 2',
        },
        {
          sourceItemId: sourceFolder._id,
          action: 'mergeFolder',
          targetParentId: null,
          destinationItemId: destinationFolder._id,
        },
      ],
    })
  })

  it('maps folder replace decisions to merge-folder move operations', () => {
    const result = planMoveOperations({
      items: [
        item('folder-1', 'Scenes', SIDEBAR_ITEM_TYPES.folders, {
          parentId: 'source-folder' as Id<'sidebarItems'>,
        }),
      ],
      targetParentId: null,
      targetItems: [item('folder-2', 'Scenes', SIDEBAR_ITEM_TYPES.folders)],
      decisions: decisions({ 'folder-1': { action: 'replace' } }),
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        {
          sourceItemId: 'folder-1',
          action: 'mergeFolder',
          targetParentId: null,
          destinationItemId: 'folder-2',
        },
      ],
    })
  })

  it('ignores descendants when an ancestor folder is also selected', () => {
    const sourceFolder = item('folder-1', 'Scenes', SIDEBAR_ITEM_TYPES.folders, {
      parentId: 'source-root' as Id<'sidebarItems'>,
    })
    const sourceChild = item('note-1', 'Ambush', SIDEBAR_ITEM_TYPES.notes, {
      parentId: sourceFolder._id,
    })

    const result = planMoveOperations({
      items: [sourceFolder, sourceChild],
      targetParentId: null,
      targetItems: [],
      getChildren: (parentId) => (parentId === sourceFolder._id ? [sourceChild] : []),
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        {
          sourceItemId: sourceFolder._id,
          action: 'move',
          targetParentId: null,
        },
      ],
    })
  })

  it('ignores deeply nested descendants when an ancestor folder is selected', () => {
    const root = item('folder-1', 'Root', SIDEBAR_ITEM_TYPES.folders, {
      parentId: 'source-root' as Id<'sidebarItems'>,
    })
    const middle = item('folder-2', 'Middle', SIDEBAR_ITEM_TYPES.folders, {
      parentId: root._id,
    })
    const leaf = item('note-1', 'Leaf', SIDEBAR_ITEM_TYPES.notes, {
      parentId: middle._id,
    })

    const result = planMoveOperations({
      items: [root, middle, leaf],
      targetParentId: null,
      targetItems: [],
      getChildren: (parentId) => {
        if (parentId === root._id) return [middle]
        if (parentId === middle._id) return [leaf]
        return []
      },
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [{ sourceItemId: root._id, action: 'move', targetParentId: null }],
    })
  })
})
