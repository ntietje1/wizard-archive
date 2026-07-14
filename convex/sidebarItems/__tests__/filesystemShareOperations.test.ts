import { executeTestFileSystemCommand } from '../../_test/filesystemCommand.helper'
import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createFolder, createNote } from '../../_test/factories.helper'
import { createTestContext } from '../../_test/setup.helper'
import type { ResourceCommand } from '@wizard-archive/editor/resources/transaction-contract'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'

type SharePermissionLevel = Extract<
  ResourceCommand,
  { type: 'setResourcesMemberPermission' }
>['permissionLevel']

async function getShareInfo(
  dmAuth: ReturnType<typeof asDm>,
  campaignId: CampaignId,
  sidebarItemId: ResourceId,
) {
  const [result] = await dmAuth.query(api.sidebarShares.queries.getSidebarItemsWithShares, {
    campaignId,
    sidebarItemIds: [sidebarItemId],
  })
  if (!result) throw new Error(`Missing share info for ${sidebarItemId}`)
  return result
}

async function executeShareCommand(
  dmAuth: ReturnType<typeof asDm>,
  args: {
    campaignId: CampaignId
    command: ResourceCommand
  },
) {
  return await executeTestFileSystemCommand(dmAuth, {
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
      campaignId: ctx.campaignDomainId,
      command: {
        type: 'setResourceAudiencePermission',
        itemIds: [noteId, folderId],
        permissionLevel: 'view' satisfies SharePermissionLevel,
      } satisfies ResourceCommand,
    })

    expect(receipt.undoable).toBe(true)
    expect(receipt.summary).toMatchObject({ kind: 'shared', affectedCount: 2 })
    expect((await getShareInfo(dmAuth, ctx.campaignDomainId, noteId)).allPermissionLevel).toBe(
      'view',
    )
    expect((await getShareInfo(dmAuth, ctx.campaignDomainId, folderId)).allPermissionLevel).toBe(
      'view',
    )

    const transactionId = receipt.transactionId
    expect(transactionId).toBeDefined()

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: transactionId!,
    })
    expect((await getShareInfo(dmAuth, ctx.campaignDomainId, noteId)).allPermissionLevel).toBeNull()
    expect(
      (await getShareInfo(dmAuth, ctx.campaignDomainId, folderId)).allPermissionLevel,
    ).toBeNull()

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: transactionId!,
    })
    expect((await getShareInfo(dmAuth, ctx.campaignDomainId, noteId)).allPermissionLevel).toBe(
      'view',
    )
    expect((await getShareInfo(dmAuth, ctx.campaignDomainId, folderId)).allPermissionLevel).toBe(
      'view',
    )
  })

  it('undoes and redoes member permission set and clear operations', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const sessionId = await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignDomainId,
      name: 'Sharing session',
    })

    const setReceipt = await executeShareCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: {
        type: 'setResourcesMemberPermission',
        itemIds: [noteId],
        campaignMemberId: ctx.player.memberDomainId,
        permissionLevel: 'edit' satisfies SharePermissionLevel,
      } satisfies ResourceCommand,
    })
    expect(setReceipt.patches).toMatchObject([
      {
        type: 'upsertResourceShare',
        share: {
          workspaceId: ctx.campaignDomainId,
          memberId: ctx.player.memberDomainId,
          sessionId,
        },
      },
    ])
    expect((await getShareInfo(dmAuth, ctx.campaignDomainId, noteId)).shares).toMatchObject([
      { campaignMemberId: ctx.player.memberDomainId, permissionLevel: 'edit' },
    ])

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: setReceipt.transactionId!,
    })
    expect((await getShareInfo(dmAuth, ctx.campaignDomainId, noteId)).shares).toEqual([])

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: setReceipt.transactionId!,
    })
    expect((await getShareInfo(dmAuth, ctx.campaignDomainId, noteId)).shares).toMatchObject([
      { campaignMemberId: ctx.player.memberDomainId, permissionLevel: 'edit' },
    ])

    const clearReceipt = await executeShareCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: {
        type: 'clearResourcesMemberPermission',
        itemIds: [noteId],
        campaignMemberId: ctx.player.memberDomainId,
      } satisfies ResourceCommand,
    })
    expect((await getShareInfo(dmAuth, ctx.campaignDomainId, noteId)).shares).toEqual([])

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: clearReceipt.transactionId!,
    })
    expect((await getShareInfo(dmAuth, ctx.campaignDomainId, noteId)).shares).toMatchObject([
      { campaignMemberId: ctx.player.memberDomainId, permissionLevel: 'edit' },
    ])

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: clearReceipt.transactionId!,
    })
    expect((await getShareInfo(dmAuth, ctx.campaignDomainId, noteId)).shares).toEqual([])
  })

  it('undoes and redoes a folder inheritance toggle', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    const receipt = await executeShareCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: {
        type: 'setFolderInheritShares',
        folderId,
        inheritShares: true,
      } satisfies ResourceCommand,
    })

    expect((await getShareInfo(dmAuth, ctx.campaignDomainId, folderId)).inheritShares).toBe(true)

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: receipt.transactionId!,
    })
    expect((await getShareInfo(dmAuth, ctx.campaignDomainId, folderId)).inheritShares).toBe(false)

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: receipt.transactionId!,
    })
    expect((await getShareInfo(dmAuth, ctx.campaignDomainId, folderId)).inheritShares).toBe(true)
  })

  it('rejects filesystem share commands from full-access players', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      allPermissionLevel: 'full_access',
    })

    await expect(
      executeTestFileSystemCommand(playerAuth, {
        campaignId: ctx.campaignDomainId,
        command: {
          type: 'setResourceAudiencePermission',
          itemIds: [noteId],
          permissionLevel: 'view',
        } satisfies ResourceCommand,
      }),
    ).rejects.toThrow('Only the DM can perform this action')

    expect((await getShareInfo(dmAuth, ctx.campaignDomainId, noteId)).allPermissionLevel).toBe(
      'full_access',
    )
  })
})
