import { describe, expect, it } from 'vite-plus/test'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import { RESOURCE_TYPES } from '../../../workspace/items-persistence-contract'
import { planFileSystemDropIntent } from '../intent-planning'
import { createSidebarItem, createTrashedSidebarItem } from './test-sidebar-item'

const actorWithFullWorkspaceCapabilities = {
  canCreateRootItems: true,
  canManageFolders: true,
}

describe('filesystem intent planning', () => {
  it('plans trash drops and ignores already trashed items', () => {
    const actor = actorWithFullWorkspaceCapabilities
    const active = createSidebarItem('note-1', 'Active')
    const trashed = createTrashedSidebarItem('note-2', 'Trashed')

    expect(
      planFileSystemDropIntent({
        actor,
        items: [active, trashed],
        target: { type: 'trash', label: 'Trash' },
      }),
    ).toEqual({
      status: 'ready',
      plan: {
        command: { type: 'trash', itemIds: [active.id] },
        label: 'Move item to "Trash"',
      },
    })
  })

  it('plans copy, move, and restore drops to parent targets', () => {
    const actor = actorWithFullWorkspaceCapabilities
    const target = createSidebarItem('folder-1', 'Folder', RESOURCE_TYPES.folders)
    const source = createSidebarItem('note-1', 'Source')
    const trashed = createTrashedSidebarItem('note-2', 'Trashed')
    const parentTarget = { parentId: target.id, parent: target, ancestorIds: [target.id] }

    expect(
      planFileSystemDropIntent({
        actor,
        items: [source],
        target: { type: 'parent', target: parentTarget, label: 'Folder' },
      }),
    ).toEqual({
      status: 'ready',
      plan: {
        command: { type: 'move', itemIds: [source.id], targetParentId: target.id },
        label: 'Move item to "Folder"',
      },
    })
    expect(
      planFileSystemDropIntent({
        actor,
        items: [source],
        target: { type: 'parent', target: parentTarget, label: 'Folder' },
        options: { copy: true },
      }),
    ).toEqual({
      status: 'ready',
      plan: {
        command: { type: 'copy', itemIds: [source.id], targetParentId: target.id },
        label: 'Copy item to "Folder"',
      },
    })
    expect(
      planFileSystemDropIntent({
        actor,
        items: [trashed],
        target: { type: 'parent', target: parentTarget, label: 'Folder' },
      }),
    ).toEqual({
      status: 'ready',
      plan: {
        command: { type: 'restore', itemIds: [trashed.id], targetParentId: target.id },
        label: 'Restore item to "Folder"',
      },
    })
  })

  it('returns labels with ready filesystem command plans', () => {
    const actor = actorWithFullWorkspaceCapabilities
    const target = createSidebarItem('folder-1', 'Scenes', RESOURCE_TYPES.folders)
    const source = createSidebarItem('note-1', 'Source')
    const parentTarget = { parentId: target.id, parent: target, ancestorIds: [target.id] }

    expect(
      planFileSystemDropIntent({
        actor,
        items: [source],
        target: { type: 'parent', target: parentTarget, label: 'Scenes' },
      }),
    ).toEqual({
      status: 'ready',
      plan: {
        command: { type: 'move', itemIds: [source.id], targetParentId: target.id },
        label: 'Move item to "Scenes"',
      },
    })
    expect(
      planFileSystemDropIntent({
        actor,
        items: [source],
        target: { type: 'trash', label: 'Trash' },
      }),
    ).toEqual({
      status: 'ready',
      plan: {
        command: { type: 'trash', itemIds: [source.id] },
        label: 'Move item to "Trash"',
      },
    })
  })

  it('blocks mixed move and restore drops', () => {
    const actor = actorWithFullWorkspaceCapabilities
    const target = createSidebarItem('folder-1', 'Folder', RESOURCE_TYPES.folders)
    const active = createSidebarItem('note-1', 'Active')
    const trashed = createTrashedSidebarItem('note-2', 'Trashed')

    expect(
      planFileSystemDropIntent({
        actor,
        items: [active, trashed],
        target: {
          type: 'parent',
          target: { parentId: target.id, parent: target, ancestorIds: [target.id] },
          label: 'Folder',
        },
      }),
    ).toEqual({ status: 'blocked', reason: 'mixed_actions' })
  })

  it('blocks copy drops when source permissions are insufficient', () => {
    const actor = actorWithFullWorkspaceCapabilities
    const target = createSidebarItem('folder-1', 'Folder', RESOURCE_TYPES.folders)
    const source = createSidebarItem('note-1', 'Source', RESOURCE_TYPES.notes, {
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })

    expect(
      planFileSystemDropIntent({
        actor,
        items: [source],
        target: {
          type: 'parent',
          target: { parentId: target.id, parent: target, ancestorIds: [target.id] },
          label: 'Folder',
        },
        options: { copy: true },
      }),
    ).toEqual({ status: 'blocked', reason: 'no_source_permission' })
  })

  it('blocks non-DM moves and restores to the root', () => {
    const actor = {
      canCreateRootItems: false,
      canManageFolders: false,
    }
    const sourceParent = createSidebarItem('folder-1', 'Folder', RESOURCE_TYPES.folders)
    const active = createSidebarItem('note-1', 'Active', RESOURCE_TYPES.notes, {
      parentId: sourceParent.id,
    })
    const trashed = createTrashedSidebarItem('note-2', 'Trashed')
    const rootTarget = { parentId: null, parent: null }

    expect(
      planFileSystemDropIntent({
        actor,
        items: [active],
        target: { type: 'parent', target: rootTarget, label: 'Root' },
      }),
    ).toEqual({ status: 'blocked', reason: 'dm_only' })

    expect(
      planFileSystemDropIntent({
        actor,
        items: [trashed],
        target: { type: 'parent', target: rootTarget, label: 'Root' },
      }),
    ).toEqual({ status: 'blocked', reason: 'dm_only' })
  })
})
