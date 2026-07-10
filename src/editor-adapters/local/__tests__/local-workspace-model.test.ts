import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import type { CampaignMemberId, SidebarItemId } from 'shared/common/ids'
import {
  completeWizardEditorResourceCommand,
  WIZARD_EDITOR_RESOURCE_COMMAND_TYPE,
  WIZARD_EDITOR_RESOURCE_EVENT_TYPE,
} from '@wizard-archive/editor/adapter'
import { createLocalItemCreationSession, localWorkspaceReducer } from '../local-workspace-model'
import type { LocalWorkspaceState } from '../local-workspace-model'
import { SAMPLE_LOCAL_WORKSPACE } from '../sample-local-workspace'

afterEach(() => {
  vi.useRealTimers()
})

describe('localWorkspaceReducer', () => {
  it('records local item lifecycle timestamps at mutation time', () => {
    vi.useFakeTimers()
    const createdAt = Date.UTC(2026, 6, 1, 16, 0, 0)
    const editedAt = Date.UTC(2026, 6, 1, 16, 5, 0)
    const trashedAt = Date.UTC(2026, 6, 1, 16, 10, 0)
    const restoredAt = Date.UTC(2026, 6, 1, 16, 15, 0)
    const session = createLocalItemCreationSession(SAMPLE_LOCAL_WORKSPACE.nextLocalItemIndex)

    vi.setSystemTime(createdAt)
    const creation = session.create({
      parentId: null,
      type: 'note',
    })
    const createdWorkspace = localWorkspaceReducer(SAMPLE_LOCAL_WORKSPACE, {
      type: 'createItem',
      creation,
    })

    expect(createdWorkspace.items.find((item) => item.id === creation.id)).toMatchObject({
      createdAt,
      updatedAt: createdAt,
      trashedAt: null,
    })

    vi.setSystemTime(editedAt)
    const editedWorkspace = localWorkspaceReducer(createdWorkspace, {
      type: 'replaceNoteBody',
      itemId: creation.id,
      body: 'Updated local body',
    })

    expect(editedWorkspace.items.find((item) => item.id === creation.id)).toMatchObject({
      createdAt,
      updatedAt: editedAt,
      trashedAt: null,
    })

    vi.setSystemTime(trashedAt)
    const trashedWorkspace = localWorkspaceReducer(editedWorkspace, {
      type: 'trashItems',
      itemIds: [creation.id],
    })

    expect(trashedWorkspace.items.find((item) => item.id === creation.id)).toMatchObject({
      createdAt,
      status: 'trash',
      updatedAt: trashedAt,
      trashedAt,
    })

    vi.setSystemTime(restoredAt)
    const restoredWorkspace = localWorkspaceReducer(trashedWorkspace, {
      type: 'restoreItems',
      itemIds: [creation.id],
      targetParentId: null,
    })

    expect(restoredWorkspace.items.find((item) => item.id === creation.id)).toMatchObject({
      createdAt,
      status: 'active',
      updatedAt: restoredAt,
      trashedAt: null,
    })
  })

  it('rejects local item creations under invalid parent targets', () => {
    const session = createLocalItemCreationSession(SAMPLE_LOCAL_WORKSPACE.nextLocalItemIndex)
    const creation = session.create({
      parentId: 'note-market',
      type: 'note',
    })

    const nextWorkspace = localWorkspaceReducer(SAMPLE_LOCAL_WORKSPACE, {
      type: 'createItem',
      creation,
    })

    expect(nextWorkspace).toBe(SAMPLE_LOCAL_WORKSPACE)
  })

  it('rejects local item creations when the action id and item id diverge', () => {
    const session = createLocalItemCreationSession(SAMPLE_LOCAL_WORKSPACE.nextLocalItemIndex)
    const creation = session.create({
      parentId: null,
      type: 'note',
    })

    const nextWorkspace = localWorkspaceReducer(SAMPLE_LOCAL_WORKSPACE, {
      type: 'createItem',
      creation: {
        ...creation,
        item: { ...creation.item, id: 'local-note-mismatch' },
      },
    })

    expect(nextWorkspace).toBe(SAMPLE_LOCAL_WORKSPACE)
  })

  it('rejects duplicate local item creation ids', () => {
    const session = createLocalItemCreationSession(SAMPLE_LOCAL_WORKSPACE.nextLocalItemIndex)
    const creation = session.create({
      parentId: null,
      type: 'note',
    })

    const createdWorkspace = localWorkspaceReducer(SAMPLE_LOCAL_WORKSPACE, {
      type: 'createItem',
      creation,
    })
    const replayedWorkspace = localWorkspaceReducer(createdWorkspace, {
      type: 'createItem',
      creation,
    })

    expect(replayedWorkspace).toBe(createdWorkspace)
    expect(replayedWorkspace.items.filter((item) => item.id === creation.id)).toHaveLength(1)
    expect(replayedWorkspace.nextLocalItemIndex).toBe(creation.nextLocalItemIndex)
  })

  it('copies local member item permissions onto copied folder descendants', () => {
    const playerId = 'local-player' as CampaignMemberId
    const workspace = withLocalFolderTreePermissions(playerId)

    const nextWorkspace = applyLocalCopyReceipt(workspace, ['local-folder-2'], null, [
      ['local-folder-2', 'local-folder-4'],
      ['local-note-3', 'local-note-5'],
    ])

    expect(nextWorkspace.memberItemPermissionsById?.['local-folder-4']).toEqual({
      [playerId]: PERMISSION_LEVEL.VIEW,
    })
    expect(nextWorkspace.memberItemPermissionsById?.['local-note-5']).toEqual({
      [playerId]: PERMISSION_LEVEL.NONE,
    })
  })

  it('uses copied ids from the committed receipt as the mutation source', () => {
    const nextWorkspace = applyLocalCopyReceipt(SAMPLE_LOCAL_WORKSPACE, ['note-market'], null, [
      ['note-market', 'receipt-owned-copy'],
    ])

    expect(nextWorkspace.items).toContainEqual(
      expect.objectContaining({ id: 'receipt-owned-copy', slug: 'receipt-owned-copy' }),
    )
    expect(nextWorkspace.items.some((item) => item.id === 'local-note-2')).toBe(false)
  })

  it('deletes local member item permissions with permanently deleted items', () => {
    const playerId = 'local-player' as CampaignMemberId
    const workspace: LocalWorkspaceState = {
      ...SAMPLE_LOCAL_WORKSPACE,
      memberItemPermissionsById: {
        'canvas-heist': { [playerId]: PERMISSION_LEVEL.VIEW },
        'note-market': { [playerId]: PERMISSION_LEVEL.NONE },
      },
    }

    const trashedWorkspace = localWorkspaceReducer(workspace, {
      type: 'trashItems',
      itemIds: ['note-market'],
    })
    const nextWorkspace = localWorkspaceReducer(trashedWorkspace, {
      type: 'deleteItemsForever',
      itemIds: ['note-market'],
    })

    expect(nextWorkspace.memberItemPermissionsById).toEqual({
      'canvas-heist': { [playerId]: PERMISSION_LEVEL.VIEW },
    })
  })

  it('rejects moving a local folder under itself', () => {
    const workspace = withLocalFolderTree()

    const nextWorkspace = localWorkspaceReducer(workspace, {
      type: 'moveItems',
      itemIds: ['local-folder-2'],
      targetParentId: 'local-folder-2',
    })

    expect(nextWorkspace).toBe(workspace)
  })

  it('rejects moving a local folder under one of its descendants', () => {
    const workspace = withLocalFolderTree()

    const nextWorkspace = localWorkspaceReducer(workspace, {
      type: 'moveItems',
      itemIds: ['local-folder-2'],
      targetParentId: 'local-folder-3',
    })

    expect(nextWorkspace).toBe(workspace)
  })
})

function applyLocalCopyReceipt(
  state: LocalWorkspaceState,
  itemIds: Array<string>,
  targetParentId: string | null,
  copies: Array<readonly [sourceItemId: string, copiedItemId: string]>,
) {
  const result = completeWizardEditorResourceCommand(
    {
      type: WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.copy,
      itemIds: itemIds as Array<SidebarItemId>,
      targetParentId: targetParentId as SidebarItemId | null,
    },
    copies.map(([sourceItemId, itemId]) => ({
      type: WIZARD_EDITOR_RESOURCE_EVENT_TYPE.copied,
      sourceItemId: sourceItemId as SidebarItemId,
      itemId: itemId as SidebarItemId,
    })),
  )
  if (result.status !== 'completed') throw new Error('Expected completed local copy receipt')
  return localWorkspaceReducer(state, {
    type: 'applyResourceCommandReceipt',
    receipt: result.receipt,
  })
}

function withLocalFolderTree(): LocalWorkspaceState {
  const session = createLocalItemCreationSession(SAMPLE_LOCAL_WORKSPACE.nextLocalItemIndex)
  const folder = session.create({
    parentId: null,
    type: 'folder',
  })
  const childFolder = session.create({
    parentId: folder.id,
    type: 'folder',
  })
  const workspaceWithFolder = localWorkspaceReducer(SAMPLE_LOCAL_WORKSPACE, {
    type: 'createItem',
    creation: folder,
  })
  return localWorkspaceReducer(workspaceWithFolder, {
    type: 'createItem',
    creation: childFolder,
  })
}

function withLocalFolderTreePermissions(playerId: CampaignMemberId): LocalWorkspaceState {
  const session = createLocalItemCreationSession(SAMPLE_LOCAL_WORKSPACE.nextLocalItemIndex)
  const folder = session.create({
    parentId: null,
    type: 'folder',
  })
  const childNote = session.create({
    parentId: folder.id,
    type: 'note',
  })
  const workspaceWithFolder = localWorkspaceReducer(SAMPLE_LOCAL_WORKSPACE, {
    type: 'createItem',
    creation: folder,
  })
  const workspaceWithChild = localWorkspaceReducer(workspaceWithFolder, {
    type: 'createItem',
    creation: childNote,
  })

  return {
    ...workspaceWithChild,
    memberItemPermissionsById: {
      [folder.id]: { [playerId]: PERMISSION_LEVEL.VIEW },
      [childNote.id]: { [playerId]: PERMISSION_LEVEL.NONE },
    },
  }
}
