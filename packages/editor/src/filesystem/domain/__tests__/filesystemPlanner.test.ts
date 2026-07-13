import { describe, expect, it } from 'vite-plus/test'
import { RESOURCE_TYPES } from '../../../workspace/items-persistence-contract'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import { createSidebarItem } from './test-sidebar-item'
import {
  createMergeFolderFixture,
  decisions,
  planCopyTransfer,
  planMoveTransfer,
} from './transfer-planning-test-helpers'

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
      items: [createSidebarItem('note-1', 'Scene')],
      targetParentId: null,
      targetItems: [createSidebarItem('note-2', 'Scene')],
    })

    expect(result.status).toBe('needs-decision')
    expect(result.operations).toEqual([])
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
      items: [createSidebarItem('note-1', 'Scene')],
      targetParentId: null,
      targetItems: [createSidebarItem('note-2', 'Scene'), createSidebarItem('note-3', 'Scene 2')],
      decisions: decisions({ 'note-1': 'keepBoth' }),
    })

    expect(result.status).toBe('ready')
    expect(result.operations).toEqual([
      { sourceItemId: 'note-1', action: 'place', targetParentId: null, name: 'Scene 1' },
    ])
  })

  it('auto keeps both when duplicating an item into its current parent', () => {
    const source = createSidebarItem('note-1', 'Scene')
    const result = planCopyTransfer({
      items: [source],
      targetParentId: null,
      targetItems: [source, createSidebarItem('note-2', 'Scene 2')],
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        { sourceItemId: 'note-1', action: 'place', targetParentId: null, name: 'Scene 1' },
      ],
    })
  })

  it('maps replace to replace for files and rejects replace for folder conflicts', () => {
    const fileResult = planCopyTransfer({
      items: [createSidebarItem('file-1', 'Handout', RESOURCE_TYPES.files)],
      targetParentId: null,
      targetItems: [createSidebarItem('file-2', 'Handout', RESOURCE_TYPES.files)],
      decisions: decisions({ 'file-1': 'replace' }),
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
    expect(() =>
      planCopyTransfer({
        items: [createSidebarItem('folder-1', 'Locations', RESOURCE_TYPES.folders)],
        targetParentId: null,
        targetItems: [createSidebarItem('folder-2', 'Locations', RESOURCE_TYPES.folders)],
        decisions: decisions({ 'folder-1': 'replace' }),
      }),
    ).toThrow('Folder conflicts require mergeFolder decisions')
  })

  it('consumes replacement destinations before planning later same-name sources', () => {
    const result = planCopyTransfer({
      items: [
        createSidebarItem('file-1', 'Handout', RESOURCE_TYPES.files),
        createSidebarItem('file-2', 'Handout', RESOURCE_TYPES.files),
      ],
      targetParentId: null,
      targetItems: [createSidebarItem('file-3', 'Handout', RESOURCE_TYPES.files)],
      decisions: decisions({ 'file-1': 'replace' }),
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        {
          sourceItemId: 'file-1',
          action: 'replace',
          targetParentId: null,
          destinationItemId: 'file-3',
          name: 'Handout',
        },
        { sourceItemId: 'file-2', action: 'place', targetParentId: null, name: 'Handout 1' },
      ],
    })
  })

  it('propagates folder merge decisions to descendant duplicate conflicts', () => {
    const { sourceFolder, destinationFolder, sourceChild, destinationChild, getChildren } =
      createMergeFolderFixture()

    const result = planCopyTransfer({
      items: [sourceFolder],
      targetParentId: null,
      targetItems: [destinationFolder],
      decisions: decisions({ 'folder-1': 'mergeFolder' }),
      getChildren,
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        {
          sourceItemId: sourceChild.id,
          action: 'replace',
          targetParentId: destinationFolder.id,
          destinationItemId: destinationChild.id,
          name: 'Ambush',
        },
        {
          sourceItemId: sourceFolder.id,
          action: 'mergeFolder',
          targetParentId: null,
          destinationItemId: destinationFolder.id,
        },
      ],
    })
  })

  it('supports skip decisions', () => {
    const skipResult = planCopyTransfer({
      items: [createSidebarItem('note-1', 'Scene')],
      targetParentId: null,
      targetItems: [createSidebarItem('note-2', 'Scene')],
      decisions: decisions({ 'note-1': 'skip' }),
    })

    expect(skipResult).toMatchObject({ status: 'ready', operations: [] })
  })

  it('ignores descendants when an ancestor folder is also selected', () => {
    const sourceFolder = createSidebarItem('folder-1', 'Scenes', RESOURCE_TYPES.folders)
    const sourceChild = createSidebarItem('note-1', 'Ambush', RESOURCE_TYPES.notes, {
      parentId: sourceFolder.id,
    })

    const result = planCopyTransfer({
      items: [sourceFolder, sourceChild],
      targetParentId: null,
      targetItems: [],
      getChildren: (parentId) => (parentId === sourceFolder.id ? [sourceChild] : []),
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        {
          sourceItemId: sourceFolder.id,
          action: 'place',
          targetParentId: null,
          name: 'Scenes',
        },
      ],
    })
  })

  it('surfaces multiple unresolved duplicate conflicts together', () => {
    const result = planCopyTransfer({
      items: [createSidebarItem('note-1', 'Scene'), createSidebarItem('note-2', 'Clue')],
      targetParentId: null,
      targetItems: [createSidebarItem('note-3', 'Scene'), createSidebarItem('note-4', 'Clue')],
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
    const source = createSidebarItem('note-1', 'Scene', RESOURCE_TYPES.notes, {
      parentId: 'source-folder' as SidebarItemId,
    })
    const destination = createSidebarItem('note-2', 'Scene')
    const result = planMoveTransfer({
      items: [source],
      targetParentId: null,
      targetItems: [destination],
      graphItems: [createSidebarItem('source-folder', 'Source Folder', RESOURCE_TYPES.folders)],
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
        createSidebarItem('note-1', 'Scene', RESOURCE_TYPES.notes, {
          parentId: 'source-folder' as SidebarItemId,
        }),
      ],
      targetParentId: null,
      targetItems: [createSidebarItem('note-2', 'Scene'), createSidebarItem('note-3', 'Scene 2')],
      decisions: decisions({ 'note-1': 'keepBoth' }),
      graphItems: [createSidebarItem('source-folder', 'Source Folder', RESOURCE_TYPES.folders)],
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
        createSidebarItem('note-1', 'Scene', RESOURCE_TYPES.notes, {
          parentId: 'source-folder-a' as SidebarItemId,
        }),
        createSidebarItem('note-2', 'Scene', RESOURCE_TYPES.notes, {
          parentId: 'source-folder-b' as SidebarItemId,
        }),
      ],
      targetParentId: null,
      targetItems: [],
      graphItems: [
        createSidebarItem('source-folder-a', 'Source Folder A', RESOURCE_TYPES.folders),
        createSidebarItem('source-folder-b', 'Source Folder B', RESOURCE_TYPES.folders),
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

  it('consumes replacement destinations before planning later same-name moved sources', () => {
    const result = planMoveTransfer({
      items: [
        createSidebarItem('file-1', 'Handout', RESOURCE_TYPES.files, {
          parentId: 'source-folder-a' as SidebarItemId,
        }),
        createSidebarItem('file-2', 'Handout', RESOURCE_TYPES.files, {
          parentId: 'source-folder-b' as SidebarItemId,
        }),
      ],
      targetParentId: null,
      targetItems: [createSidebarItem('file-3', 'Handout', RESOURCE_TYPES.files)],
      decisions: decisions({ 'file-1': 'replace' }),
      graphItems: [
        createSidebarItem('source-folder-a', 'Source Folder A', RESOURCE_TYPES.folders),
        createSidebarItem('source-folder-b', 'Source Folder B', RESOURCE_TYPES.folders),
      ],
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        {
          sourceItemId: 'file-1',
          action: 'replace',
          targetParentId: null,
          destinationItemId: 'file-3',
          name: 'Handout',
        },
        { sourceItemId: 'file-2', action: 'place', targetParentId: null, name: 'Handout 1' },
      ],
    })
  })

  it('deduplicates repeated selected sources', () => {
    const source = createSidebarItem('note-1', 'Scene', RESOURCE_TYPES.notes, {
      parentId: 'source-root' as SidebarItemId,
    })

    const result = planMoveTransfer({
      items: [source, source],
      targetParentId: null,
      targetItems: [],
      graphItems: [createSidebarItem('source-root', 'Source Root', RESOURCE_TYPES.folders)],
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [{ sourceItemId: source.id, action: 'place', targetParentId: null }],
    })
  })

  it('propagates folder merge decisions to descendant move conflicts', () => {
    const {
      graphItems,
      sourceFolder,
      destinationFolder,
      sourceChild,
      destinationChild,
      getChildren,
    } = createMergeFolderFixture({ withSourceRoot: true })

    const result = planMoveTransfer({
      items: [sourceFolder],
      targetParentId: null,
      targetItems: [destinationFolder],
      decisions: decisions({ 'folder-1': 'mergeFolder' }),
      graphItems,
      getChildren,
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        {
          sourceItemId: sourceChild.id,
          action: 'replace',
          targetParentId: destinationFolder.id,
          destinationItemId: destinationChild.id,
          name: 'Ambush',
        },
        {
          sourceItemId: sourceFolder.id,
          action: 'mergeFolder',
          targetParentId: null,
          destinationItemId: destinationFolder.id,
        },
      ],
    })
  })

  it('moves resolved folder merge children before cleaning up the source folder', () => {
    const { graphItems, sourceFolder, destinationFolder, sourceChild, getChildren } =
      createMergeFolderFixture({ withSourceRoot: true })

    const result = planMoveTransfer({
      items: [sourceFolder],
      targetParentId: null,
      targetItems: [destinationFolder],
      decisions: decisions({
        'folder-1': 'mergeFolder',
        'note-1': 'keepBoth',
      }),
      graphItems,
      getChildren,
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        {
          sourceItemId: sourceChild.id,
          action: 'place',
          targetParentId: destinationFolder.id,
          name: 'Ambush 1',
        },
        {
          sourceItemId: sourceFolder.id,
          action: 'mergeFolder',
          targetParentId: null,
          destinationItemId: destinationFolder.id,
        },
      ],
    })
  })

  it('maps folder merge decisions to merge-folder move operations', () => {
    const result = planMoveTransfer({
      items: [
        createSidebarItem('folder-1', 'Scenes', RESOURCE_TYPES.folders, {
          parentId: 'source-folder' as SidebarItemId,
        }),
      ],
      targetParentId: null,
      targetItems: [createSidebarItem('folder-2', 'Scenes', RESOURCE_TYPES.folders)],
      decisions: decisions({ 'folder-1': 'mergeFolder' }),
      graphItems: [createSidebarItem('source-folder', 'Source Folder', RESOURCE_TYPES.folders)],
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
    const sourceFolder = createSidebarItem('folder-1', 'Scenes', RESOURCE_TYPES.folders, {
      parentId: 'source-root' as SidebarItemId,
    })
    const sourceChild = createSidebarItem('note-1', 'Ambush', RESOURCE_TYPES.notes, {
      parentId: sourceFolder.id,
    })

    const result = planMoveTransfer({
      items: [sourceFolder, sourceChild],
      targetParentId: null,
      targetItems: [],
      graphItems: [createSidebarItem('source-root', 'Source Root', RESOURCE_TYPES.folders)],
      getChildren: (parentId) => (parentId === sourceFolder.id ? [sourceChild] : []),
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        {
          sourceItemId: sourceFolder.id,
          action: 'place',
          targetParentId: null,
        },
      ],
    })
  })

  it('ignores deeply nested descendants when an ancestor folder is selected', () => {
    const root = createSidebarItem('folder-1', 'Root', RESOURCE_TYPES.folders, {
      parentId: 'source-root' as SidebarItemId,
    })
    const middle = createSidebarItem('folder-2', 'Middle', RESOURCE_TYPES.folders, {
      parentId: root.id,
    })
    const leaf = createSidebarItem('note-1', 'Leaf', RESOURCE_TYPES.notes, {
      parentId: middle.id,
    })

    const result = planMoveTransfer({
      items: [root, middle, leaf],
      targetParentId: null,
      targetItems: [],
      graphItems: [createSidebarItem('source-root', 'Source Root', RESOURCE_TYPES.folders)],
      getChildren: (parentId) => {
        if (parentId === root.id) return [middle]
        if (parentId === middle.id) return [leaf]
        return []
      },
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [{ sourceItemId: root.id, action: 'place', targetParentId: null }],
    })
  })
})
