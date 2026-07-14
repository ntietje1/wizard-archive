import type { CampaignMemberId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import {
  completeWizardEditorResourceCommand,
  WIZARD_EDITOR_RESOURCE_COMMAND_TYPE,
  WIZARD_EDITOR_RESOURCE_EVENT_TYPE,
} from '@wizard-archive/editor/adapter'
import { createLocalItemCreationSession, localWorkspaceReducer } from '../local-workspace-model'
import type { LocalWorkspaceState } from '../local-workspace-model'
import { SAMPLE_LOCAL_RESOURCE_IDS, SAMPLE_LOCAL_WORKSPACE } from '../sample-local-workspace'
import { testCampaignMemberId } from 'shared/test/campaign-member-id'
import { testResourceId } from 'shared/test/resource-id'

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
      parentId: SAMPLE_LOCAL_RESOURCE_IDS.marketNote,
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
        item: { ...creation.item, id: testResourceId('local-note-mismatch') },
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
    const playerId = testCampaignMemberId('local-player')
    const { childId, folderId, workspace } = withLocalFolderTreePermissions(playerId)
    const copiedFolderId = testResourceId('copied-folder')
    const copiedChildId = testResourceId('copied-note')

    const nextWorkspace = applyLocalCopyReceipt(workspace, [folderId], null, [
      [folderId, copiedFolderId],
      [childId, copiedChildId],
    ])

    expect(nextWorkspace.memberItemPermissionsById?.[copiedFolderId]).toEqual({
      [playerId]: PERMISSION_LEVEL.VIEW,
    })
    expect(nextWorkspace.memberItemPermissionsById?.[copiedChildId]).toEqual({
      [playerId]: PERMISSION_LEVEL.NONE,
    })
  })

  it('uses copied ids from the committed receipt as the mutation source', () => {
    const copiedId = testResourceId('receipt-owned-copy')
    const nextWorkspace = applyLocalCopyReceipt(
      SAMPLE_LOCAL_WORKSPACE,
      [SAMPLE_LOCAL_RESOURCE_IDS.marketNote],
      null,
      [[SAMPLE_LOCAL_RESOURCE_IDS.marketNote, copiedId]],
    )

    expect(nextWorkspace.items).toContainEqual(
      expect.objectContaining({ id: copiedId, slug: copiedId }),
    )
    expect(nextWorkspace.items.filter((item) => item.id === copiedId)).toHaveLength(1)
  })

  it('deletes local member item permissions with permanently deleted items', () => {
    const playerId = testCampaignMemberId('local-player')
    const workspace: LocalWorkspaceState = {
      ...SAMPLE_LOCAL_WORKSPACE,
      memberItemPermissionsById: {
        [SAMPLE_LOCAL_RESOURCE_IDS.heistCanvas]: { [playerId]: PERMISSION_LEVEL.VIEW },
        [SAMPLE_LOCAL_RESOURCE_IDS.marketNote]: { [playerId]: PERMISSION_LEVEL.NONE },
      },
    }

    const trashedWorkspace = localWorkspaceReducer(workspace, {
      type: 'trashItems',
      itemIds: [SAMPLE_LOCAL_RESOURCE_IDS.marketNote],
    })
    const nextWorkspace = localWorkspaceReducer(trashedWorkspace, {
      type: 'deleteItemsForever',
      itemIds: [SAMPLE_LOCAL_RESOURCE_IDS.marketNote],
    })

    expect(nextWorkspace.memberItemPermissionsById).toEqual({
      [SAMPLE_LOCAL_RESOURCE_IDS.heistCanvas]: { [playerId]: PERMISSION_LEVEL.VIEW },
    })
  })

  it('rejects moving a local folder under itself', () => {
    const { folderId, workspace } = withLocalFolderTree()

    const nextWorkspace = localWorkspaceReducer(workspace, {
      type: 'moveItems',
      itemIds: [folderId],
      targetParentId: folderId,
    })

    expect(nextWorkspace).toBe(workspace)
  })

  it('rejects moving a local folder under one of its descendants', () => {
    const { childId, folderId, workspace } = withLocalFolderTree()

    const nextWorkspace = localWorkspaceReducer(workspace, {
      type: 'moveItems',
      itemIds: [folderId],
      targetParentId: childId,
    })

    expect(nextWorkspace).toBe(workspace)
  })
})

function applyLocalCopyReceipt(
  state: LocalWorkspaceState,
  itemIds: Array<ResourceId>,
  targetParentId: ResourceId | null,
  copies: Array<readonly [sourceItemId: ResourceId, copiedItemId: ResourceId]>,
) {
  const result = completeWizardEditorResourceCommand(
    {
      type: WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.copy,
      itemIds,
      targetParentId,
    },
    copies.map(([sourceItemId, itemId]) => ({
      type: WIZARD_EDITOR_RESOURCE_EVENT_TYPE.copied,
      sourceItemId,
      itemId,
    })),
  )
  if (result.status !== 'completed') throw new Error('Expected completed local copy receipt')
  return localWorkspaceReducer(state, {
    type: 'applyResourceCommandReceipt',
    receipt: result.receipt,
  })
}

function withLocalFolderTree() {
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
  const workspace = localWorkspaceReducer(workspaceWithFolder, {
    type: 'createItem',
    creation: childFolder,
  })
  return { childId: childFolder.id, folderId: folder.id, workspace }
}

function withLocalFolderTreePermissions(playerId: CampaignMemberId) {
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

  const workspace = {
    ...workspaceWithChild,
    memberItemPermissionsById: {
      [folder.id]: { [playerId]: PERMISSION_LEVEL.VIEW },
      [childNote.id]: { [playerId]: PERMISSION_LEVEL.NONE },
    },
  }
  return { childId: childNote.id, folderId: folder.id, workspace }
}
