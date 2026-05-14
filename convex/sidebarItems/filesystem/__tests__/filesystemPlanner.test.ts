import { describe, expect, it } from 'vitest'
import { SIDEBAR_ITEM_TYPES } from '../../types/baseTypes'
import { PERMISSION_LEVEL } from '../../../permissions/types'
import { planTransferOperations } from '../transferPlanner'
import type { OperationPlannerItem } from '../selection'
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

function buildItemsById(
  roots: Array<OperationPlannerItem>,
  getChildren?: (parentId: Id<'sidebarItems'>) => Array<OperationPlannerItem>,
) {
  const itemsById = new Map<Id<'sidebarItems'>, OperationPlannerItem>()
  const visit = (plannerItem: OperationPlannerItem) => {
    if (itemsById.has(plannerItem._id)) return
    itemsById.set(plannerItem._id, plannerItem)
    for (const child of getChildren?.(plannerItem._id) ?? []) {
      visit(child)
    }
  }
  for (const root of roots) {
    visit(root)
  }
  return itemsById
}

function planCopyTransfer(
  args: Omit<Parameters<typeof planTransferOperations>[0], 'itemsById' | 'mode'> & {
    graphItems?: Array<OperationPlannerItem>
  },
) {
  return planTransferOperations({
    ...args,
    mode: 'copy',
    itemsById: buildItemsById(
      [...args.items, ...args.targetItems, ...(args.graphItems ?? [])],
      args.getChildren,
    ),
  })
}

function planMoveTransfer(
  args: Omit<Parameters<typeof planTransferOperations>[0], 'itemsById' | 'mode'> & {
    graphItems?: Array<OperationPlannerItem>
  },
) {
  return planTransferOperations({
    ...args,
    mode: 'move',
    itemsById: buildItemsById(
      [...args.items, ...args.targetItems, ...(args.graphItems ?? [])],
      args.getChildren,
    ),
  })
}

describe('copy transfer planning', () => {
  it('returns no operations for empty inputs', () => {
    expect(
      planCopyTransfer({
        items: [],
        targetParentId: null,
        targetItems: [],
      }),
    ).toEqual({ status: 'ready', conflicts: [], operations: [] })
  })

  it('returns a conflict when an incoming item matches a destination sibling name', () => {
    const result = planCopyTransfer({
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
    const result = planCopyTransfer({
      items: [item('note-1', 'Scene')],
      targetParentId: null,
      targetItems: [item('note-2', 'Scene'), item('note-3', 'Scene 2')],
      decisions: decisions({ 'note-1': { action: 'keepBoth' } }),
    })

    expect(result.status).toBe('ready')
    expect(result.operations).toEqual([
      { sourceItemId: 'note-1', action: 'place', targetParentId: null, name: 'Scene 1' },
    ])
  })

  it('auto keeps both when duplicating an item into its current parent', () => {
    const source = item('note-1', 'Scene')
    const result = planCopyTransfer({
      items: [source],
      targetParentId: null,
      targetItems: [source, item('note-2', 'Scene 2')],
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        { sourceItemId: 'note-1', action: 'place', targetParentId: null, name: 'Scene 1' },
      ],
    })
  })

  it('maps replace to replace for files and mergeFolder for folders', () => {
    const fileResult = planCopyTransfer({
      items: [item('file-1', 'Handout', SIDEBAR_ITEM_TYPES.files)],
      targetParentId: null,
      targetItems: [item('file-2', 'Handout', SIDEBAR_ITEM_TYPES.files)],
      decisions: decisions({ 'file-1': { action: 'replace' } }),
    })
    const folderResult = planCopyTransfer({
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

    const result = planCopyTransfer({
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
    const skipResult = planCopyTransfer({
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

    const result = planCopyTransfer({
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
          action: 'place',
          targetParentId: null,
          name: 'Scenes',
        },
      ],
    })
  })

  it('surfaces multiple unresolved duplicate conflicts together', () => {
    const result = planCopyTransfer({
      items: [item('note-1', 'Scene'), item('note-2', 'Clue')],
      targetParentId: null,
      targetItems: [item('note-3', 'Scene'), item('note-4', 'Clue')],
    })

    expect(result.status).toBe('needs-decision')
    expect(result.conflicts.map((conflict) => conflict.sourceItemId)).toEqual(['note-1', 'note-2'])
  })
})

describe('move transfer planning', () => {
  it('returns no operations for empty inputs', () => {
    expect(
      planMoveTransfer({
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
    const result = planMoveTransfer({
      items: [source],
      targetParentId: null,
      targetItems: [destination],
      graphItems: [item('source-folder', 'Source Folder', SIDEBAR_ITEM_TYPES.folders)],
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
    const result = planMoveTransfer({
      items: [
        item('note-1', 'Scene', SIDEBAR_ITEM_TYPES.notes, {
          parentId: 'source-folder' as Id<'sidebarItems'>,
        }),
      ],
      targetParentId: null,
      targetItems: [item('note-2', 'Scene'), item('note-3', 'Scene 2')],
      decisions: decisions({ 'note-1': { action: 'keepBoth' } }),
      graphItems: [item('source-folder', 'Source Folder', SIDEBAR_ITEM_TYPES.folders)],
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        { sourceItemId: 'note-1', action: 'place', targetParentId: null, name: 'Scene 1' },
      ],
    })
  })

  it('renames later incoming items that collide with earlier incoming names', () => {
    const result = planMoveTransfer({
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
      graphItems: [
        item('source-folder-a', 'Source Folder A', SIDEBAR_ITEM_TYPES.folders),
        item('source-folder-b', 'Source Folder B', SIDEBAR_ITEM_TYPES.folders),
      ],
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        { sourceItemId: 'note-1', action: 'place', targetParentId: null },
        { sourceItemId: 'note-2', action: 'place', targetParentId: null, name: 'Scene 1' },
      ],
    })
  })

  it('deduplicates repeated selected sources', () => {
    const source = item('note-1', 'Scene', SIDEBAR_ITEM_TYPES.notes, {
      parentId: 'source-root' as Id<'sidebarItems'>,
    })

    const result = planMoveTransfer({
      items: [source, source],
      targetParentId: null,
      targetItems: [],
      graphItems: [item('source-root', 'Source Root', SIDEBAR_ITEM_TYPES.folders)],
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [{ sourceItemId: source._id, action: 'place', targetParentId: null }],
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

    const result = planMoveTransfer({
      items: [sourceFolder],
      targetParentId: null,
      targetItems: [destinationFolder],
      decisions: decisions({ 'folder-1': { action: 'replace' } }),
      graphItems: [item('source-root', 'Source Root', SIDEBAR_ITEM_TYPES.folders)],
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

    const result = planMoveTransfer({
      items: [sourceFolder],
      targetParentId: null,
      targetItems: [destinationFolder],
      decisions: decisions({
        'folder-1': { action: 'replace' },
        'note-1': { action: 'keepBoth' },
      }),
      graphItems: [item('source-root', 'Source Root', SIDEBAR_ITEM_TYPES.folders)],
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
          action: 'place',
          targetParentId: destinationFolder._id,
          name: 'Ambush 1',
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
    const result = planMoveTransfer({
      items: [
        item('folder-1', 'Scenes', SIDEBAR_ITEM_TYPES.folders, {
          parentId: 'source-folder' as Id<'sidebarItems'>,
        }),
      ],
      targetParentId: null,
      targetItems: [item('folder-2', 'Scenes', SIDEBAR_ITEM_TYPES.folders)],
      decisions: decisions({ 'folder-1': { action: 'replace' } }),
      graphItems: [item('source-folder', 'Source Folder', SIDEBAR_ITEM_TYPES.folders)],
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

    const result = planMoveTransfer({
      items: [sourceFolder, sourceChild],
      targetParentId: null,
      targetItems: [],
      graphItems: [item('source-root', 'Source Root', SIDEBAR_ITEM_TYPES.folders)],
      getChildren: (parentId) => (parentId === sourceFolder._id ? [sourceChild] : []),
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        {
          sourceItemId: sourceFolder._id,
          action: 'place',
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

    const result = planMoveTransfer({
      items: [root, middle, leaf],
      targetParentId: null,
      targetItems: [],
      graphItems: [item('source-root', 'Source Root', SIDEBAR_ITEM_TYPES.folders)],
      getChildren: (parentId) => {
        if (parentId === root._id) return [middle]
        if (parentId === middle._id) return [leaf]
        return []
      },
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [{ sourceItemId: root._id, action: 'place', targetParentId: null }],
    })
  })
})
