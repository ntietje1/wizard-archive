import { describe, expect, it } from 'vite-plus/test'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import { RESOURCE_STATUS, RESOURCE_TYPES } from '../../../workspace/items-persistence-contract'
import { createSidebarItem } from './test-sidebar-item'
import {
  evaluateCopy,
  evaluateCreateItem,
  evaluateMoveToParent,
  evaluatePermanentDelete,
  evaluateRestore,
  evaluateTrash,
  isResourceOperationPermissionRejection,
} from '../operation-capabilities'

const actorWithFullWorkspaceCapabilities = {
  canCreateRootItems: true,
  canManageFolders: true,
}

const actorWithoutWorkspaceCapabilities = {
  canCreateRootItems: false,
  canManageFolders: false,
}

describe('sidebar operation capabilities', () => {
  it('requires folder management for folder creation', () => {
    expect(evaluateCreateItem(actorWithoutWorkspaceCapabilities, RESOURCE_TYPES.folders)).toEqual({
      ok: false,
      code: 'dm_only',
      message: 'Only the DM can create folders',
    })
    expect(evaluateCreateItem(actorWithoutWorkspaceCapabilities, RESOURCE_TYPES.notes)).toEqual({
      ok: true,
    })
  })

  it('rejects player trashing a folder', () => {
    const result = evaluateTrash(
      actorWithoutWorkspaceCapabilities,
      createSidebarItem('folder-1', 'Folder', RESOURCE_TYPES.folders),
    )

    expect(result).toEqual({
      ok: false,
      code: 'dm_only',
      message: 'Only the DM can trash folders',
    })
  })

  it('rejects moving an item without full source access', () => {
    const result = evaluateMoveToParent(
      actorWithFullWorkspaceCapabilities,
      createSidebarItem('note-1', 'Note', RESOURCE_TYPES.notes, {
        myPermissionLevel: PERMISSION_LEVEL.EDIT,
      }),
      { parentId: null, parent: null },
    )

    expect(result).toEqual({
      ok: false,
      code: 'no_source_permission',
      message: 'You do not have sufficient permission for this item',
    })
  })

  it('rejects moving into a folder without full target access', () => {
    const parent = createSidebarItem('folder-1', 'Folder', RESOURCE_TYPES.folders, {
      myPermissionLevel: PERMISSION_LEVEL.EDIT,
    })

    const result = evaluateMoveToParent(
      actorWithFullWorkspaceCapabilities,
      createSidebarItem('note-1', 'Note', RESOURCE_TYPES.notes),
      {
        parentId: parent.id,
        parent,
      },
    )

    expect(result).toEqual({
      ok: false,
      code: 'no_target_permission',
      message: 'You do not have sufficient permission for this folder',
    })
  })

  it('distinguishes inactive target parents from missing parents', () => {
    const parent = createSidebarItem('folder-1', 'Folder', RESOURCE_TYPES.folders, {
      status: RESOURCE_STATUS.undoHidden,
    })

    const result = evaluateMoveToParent(
      actorWithFullWorkspaceCapabilities,
      createSidebarItem('note-1', 'Note', RESOURCE_TYPES.notes),
      {
        parentId: parent.id,
        parent,
      },
    )

    expect(result).toEqual({
      ok: false,
      code: 'invalid_target',
      message: 'Parent is no longer available',
    })
  })

  it('rejects moving a folder into its descendant', () => {
    const folder = createSidebarItem('folder-1', 'Folder', RESOURCE_TYPES.folders)
    const descendant = createSidebarItem('folder-2', 'Child', RESOURCE_TYPES.folders)

    const result = evaluateMoveToParent(actorWithFullWorkspaceCapabilities, folder, {
      parentId: descendant.id,
      parent: descendant,
      ancestorIds: [folder.id],
    })

    expect(result).toEqual({
      ok: false,
      code: 'circular',
      message: 'This move would create a circular reference',
    })
  })

  it('allows players to move items with full access into folders with full access', () => {
    const parent = createSidebarItem('folder-1', 'Folder', RESOURCE_TYPES.folders)

    expect(
      evaluateMoveToParent(actorWithoutWorkspaceCapabilities, createSidebarItem('note-1', 'Note'), {
        parentId: parent.id,
        parent,
      }),
    ).toEqual({ ok: true })
  })

  it('rejects players moving folders without target ancestry', () => {
    const folder = createSidebarItem('folder-1', 'Folder', RESOURCE_TYPES.folders)
    const parent = createSidebarItem('folder-2', 'Target', RESOURCE_TYPES.folders)

    expect(
      evaluateMoveToParent(actorWithoutWorkspaceCapabilities, folder, {
        parentId: parent.id,
        parent,
      }),
    ).toEqual({
      ok: false,
      code: 'missing_ancestor_ids',
      message: 'Folder target ancestry is required',
    })
  })

  it('rejects players permanently deleting folders', () => {
    const folder = createSidebarItem('folder-1', 'Folder', RESOURCE_TYPES.folders, {
      status: 'trashed',
    })

    expect(evaluatePermanentDelete(actorWithoutWorkspaceCapabilities, folder)).toEqual({
      ok: false,
      code: 'dm_only',
      message: 'Only the DM can permanently delete folders',
    })
  })

  it('rejects players permanently deleting notes without full access', () => {
    const note = createSidebarItem('note-1', 'Note', RESOURCE_TYPES.notes, {
      status: 'trashed',
      myPermissionLevel: PERMISSION_LEVEL.EDIT,
    })

    expect(evaluatePermanentDelete(actorWithoutWorkspaceCapabilities, note)).toEqual({
      ok: false,
      code: 'no_source_permission',
      message: 'You do not have sufficient permission for this item',
    })
  })

  it('rejects workspace managers permanently deleting notes without full access', () => {
    const note = createSidebarItem('note-1', 'Note', RESOURCE_TYPES.notes, {
      status: 'trashed',
      myPermissionLevel: PERMISSION_LEVEL.EDIT,
    })

    expect(evaluatePermanentDelete(actorWithFullWorkspaceCapabilities, note)).toEqual({
      ok: false,
      code: 'no_source_permission',
      message: 'You do not have sufficient permission for this item',
    })
  })

  it('allows players to permanently delete trashed notes with full access', () => {
    const note = createSidebarItem('note-1', 'Note', RESOURCE_TYPES.notes, {
      status: 'trashed',
      myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    })

    expect(evaluatePermanentDelete(actorWithoutWorkspaceCapabilities, note)).toEqual({
      ok: true,
    })
  })

  it('rejects players copying to the root', () => {
    expect(
      evaluateCopy(actorWithoutWorkspaceCapabilities, createSidebarItem('note-1', 'Note'), {
        parentId: null,
        parent: null,
      }),
    ).toEqual({
      ok: false,
      code: 'dm_only',
      message: 'Only the DM can create items at the root level',
    })
  })

  it('rejects permanently deleting an active item', () => {
    const result = evaluatePermanentDelete(
      actorWithFullWorkspaceCapabilities,
      createSidebarItem('note-1', 'Note', RESOURCE_TYPES.notes),
    )

    expect(result).toEqual({
      ok: false,
      code: 'not_trashed',
      message: 'This item is no longer in the trash',
    })
  })

  it('allows DM to trash items', () => {
    expect(
      evaluateTrash(
        actorWithFullWorkspaceCapabilities,
        createSidebarItem('note-2', 'Note', RESOURCE_TYPES.notes),
      ),
    ).toEqual({ ok: true })
  })

  it('allows DM to permanently delete trashed items', () => {
    const trashedNote = createSidebarItem('note-1', 'Note', RESOURCE_TYPES.notes, {
      status: 'trashed',
    })

    expect(evaluatePermanentDelete(actorWithFullWorkspaceCapabilities, trashedNote)).toEqual({
      ok: true,
    })
  })

  it('rejects restoring an active item', () => {
    const result = evaluateRestore(
      actorWithFullWorkspaceCapabilities,
      createSidebarItem('note-1', 'Note', RESOURCE_TYPES.notes),
      { parentId: null, parent: null },
    )

    expect(result).toEqual({
      ok: false,
      code: 'not_trashed',
      message: 'Only trashed items can be restored',
    })
  })

  it('rejects player restoring a note to the root', () => {
    const result = evaluateRestore(
      actorWithoutWorkspaceCapabilities,
      createSidebarItem('note-1', 'Note', RESOURCE_TYPES.notes, {
        status: 'trashed',
      }),
      { parentId: null, parent: null },
    )

    expect(result).toEqual({
      ok: false,
      code: 'dm_only',
      message: 'Only the DM can create items at the root level',
    })
  })

  it('rejects player restoring a folder', () => {
    const result = evaluateRestore(
      actorWithoutWorkspaceCapabilities,
      createSidebarItem('folder-1', 'Folder', RESOURCE_TYPES.folders, {
        status: 'trashed',
      }),
      { parentId: null, parent: null },
    )

    expect(result).toEqual({
      ok: false,
      code: 'dm_only',
      message: 'Only the DM can restore folders',
    })
  })

  it('allows DM to restore trashed items to the root', () => {
    const trashedNote = createSidebarItem('note-1', 'Note', RESOURCE_TYPES.notes, {
      status: 'trashed',
    })

    expect(
      evaluateRestore(actorWithFullWorkspaceCapabilities, trashedNote, {
        parentId: null,
        parent: null,
      }),
    ).toEqual({ ok: true })
  })

  it('rejects trashing an item that is already trashed', () => {
    const result = evaluateTrash(
      actorWithFullWorkspaceCapabilities,
      createSidebarItem('note-1', 'Note', RESOURCE_TYPES.notes, {
        status: 'trashed',
      }),
    )

    expect(result).toEqual({
      ok: false,
      code: 'already_trashed',
      message: 'This item is already in the trash',
    })
  })

  it('classifies permission rejections separately from validation rejections', () => {
    expect(isResourceOperationPermissionRejection('no_source_permission')).toBe(true)
    expect(isResourceOperationPermissionRejection('no_target_permission')).toBe(true)
    expect(isResourceOperationPermissionRejection('dm_only')).toBe(true)
    expect(isResourceOperationPermissionRejection('not_found')).toBe(false)
    expect(isResourceOperationPermissionRejection('circular')).toBe(false)
  })
})
