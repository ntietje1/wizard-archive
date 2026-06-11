import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createFolder, createNote } from '../../_test/factories.helper'
import { createTestContext } from '../../_test/setup.helper'
import type { PermissionLevel } from '../../../shared/permissions/types'
import type { FileSystemCommand } from '../../../shared/sidebar-items/filesystem/commands'

async function getShareInfo(
  dmAuth: ReturnType<typeof asDm>,
  campaignId: Id<'campaigns'>,
  sidebarItemId: Id<'sidebarItems'>,
) {
  const [result] = await dmAuth.query(api.sidebarShares.queries.getSidebarItemsWithShares, {
    campaignId,
    sidebarItemIds: [sidebarItemId],
  })
  if (!result) throw new Error(`Missing share info for ${sidebarItemId}`)
  return result
}

function shareCommand(command: unknown): FileSystemCommand {
  return command as FileSystemCommand
}

async function executeShareCommand(
  dmAuth: ReturnType<typeof asDm>,
  args: {
    campaignId: Id<'campaigns'>
    command: FileSystemCommand
  },
) {
  return await dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
    campaignId: args.campaignId,
    command: args.command,
  })
}

describe('filesystem share operations', () => {
  const t = createTestContext()

  it('undoes and redoes all-player permissions for selected item batches', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    const receipt = await executeShareCommand(dmAuth, {
      campaignId: ctx.campaignId,
      command: shareCommand({
        type: 'setAllPlayersPermission',
        itemIds: [noteId, folderId],
        permissionLevel: 'view' satisfies PermissionLevel,
      }),
    })

    expect(receipt.undoable).toBe(true)
    expect(receipt.summary).toMatchObject({ kind: 'shared', affectedCount: 2 })
    expect((await getShareInfo(dmAuth, ctx.campaignId, noteId)).allPermissionLevel).toBe('view')
    expect((await getShareInfo(dmAuth, ctx.campaignId, folderId)).allPermissionLevel).toBe('view')

    const transactionId = receipt.transactionId
    expect(transactionId).toBeDefined()

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: transactionId!,
    })
    expect((await getShareInfo(dmAuth, ctx.campaignId, noteId)).allPermissionLevel).toBeNull()
    expect((await getShareInfo(dmAuth, ctx.campaignId, folderId)).allPermissionLevel).toBeNull()

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: transactionId!,
    })
    expect((await getShareInfo(dmAuth, ctx.campaignId, noteId)).allPermissionLevel).toBe('view')
    expect((await getShareInfo(dmAuth, ctx.campaignId, folderId)).allPermissionLevel).toBe('view')
  })

  it('undoes and redoes member permission set and clear operations', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const setReceipt = await executeShareCommand(dmAuth, {
      campaignId: ctx.campaignId,
      command: shareCommand({
        type: 'setSidebarItemsMemberPermission',
        itemIds: [noteId],
        campaignMemberId: ctx.player.memberId,
        permissionLevel: 'edit' satisfies PermissionLevel,
      }),
    })
    expect((await getShareInfo(dmAuth, ctx.campaignId, noteId)).shares).toMatchObject([
      { campaignMemberId: ctx.player.memberId, permissionLevel: 'edit' },
    ])

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: setReceipt.transactionId!,
    })
    expect((await getShareInfo(dmAuth, ctx.campaignId, noteId)).shares).toHaveLength(0)

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: setReceipt.transactionId!,
    })
    expect((await getShareInfo(dmAuth, ctx.campaignId, noteId)).shares).toMatchObject([
      { campaignMemberId: ctx.player.memberId, permissionLevel: 'edit' },
    ])

    const clearReceipt = await executeShareCommand(dmAuth, {
      campaignId: ctx.campaignId,
      command: shareCommand({
        type: 'clearSidebarItemsMemberPermission',
        itemIds: [noteId],
        campaignMemberId: ctx.player.memberId,
      }),
    })
    expect((await getShareInfo(dmAuth, ctx.campaignId, noteId)).shares).toHaveLength(0)

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: clearReceipt.transactionId!,
    })
    expect((await getShareInfo(dmAuth, ctx.campaignId, noteId)).shares).toMatchObject([
      { campaignMemberId: ctx.player.memberId, permissionLevel: 'edit' },
    ])
  })

  it('undoes and redoes a folder inheritance toggle', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    const receipt = await executeShareCommand(dmAuth, {
      campaignId: ctx.campaignId,
      command: shareCommand({
        type: 'setFolderInheritShares',
        folderId,
        inheritShares: true,
      }),
    })

    expect((await getShareInfo(dmAuth, ctx.campaignId, folderId)).inheritShares).toBe(true)

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: receipt.transactionId!,
    })
    expect((await getShareInfo(dmAuth, ctx.campaignId, folderId)).inheritShares).toBe(false)

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: receipt.transactionId!,
    })
    expect((await getShareInfo(dmAuth, ctx.campaignId, folderId)).inheritShares).toBe(true)
  })

  it('rejects stale share undo instead of overwriting newer permission changes', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const receipt = await executeShareCommand(dmAuth, {
      campaignId: ctx.campaignId,
      command: shareCommand({
        type: 'setAllPlayersPermission',
        itemIds: [noteId],
        permissionLevel: 'view' satisfies PermissionLevel,
      }),
    })

    await dmAuth.mutation(api.sidebarShares.mutations.setAllPlayersPermissionForSidebarItems, {
      campaignId: ctx.campaignId,
      sidebarItemIds: [noteId],
      permissionLevel: 'edit',
    })

    await expect(
      dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
        campaignId: ctx.campaignId,
        transactionId: receipt.transactionId!,
      }),
    ).rejects.toThrow('Filesystem transaction can no longer be applied cleanly')
    expect((await getShareInfo(dmAuth, ctx.campaignId, noteId)).allPermissionLevel).toBe('edit')
  })
})
