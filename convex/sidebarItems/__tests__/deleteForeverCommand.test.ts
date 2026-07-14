import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import {
  createFolder,
  createNote,
  createSidebarShare,
  executeDeleteForeverCommand,
  executeMoveCommand,
} from '../../_test/factories.helper'
import { expectNotFound, expectPermissionDenied } from '../../_test/assertions.helper'

describe('executeDeleteForeverCommand', () => {
  const t = createTestContext()

  it('only works on trashed items', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotFound(
      executeDeleteForeverCommand(dmAuth, {
        campaignId: ctx.campaignDomainId,
        sourceItemIds: [noteId],
      }),
    )
  })

  it('hard-deletes a trashed item', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'trash',
    })

    await executeDeleteForeverCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [noteId],
    })

    const deleted = await t.run(async (dbCtx) => {
      return await dbCtx.db.get('sidebarItems', noteId)
    })
    expect(deleted).toBeNull()
  })

  it('requires DM for permanently deleting folders', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      allPermissionLevel: 'full_access',
    })

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [folderId],
      targetParentId: null,
      action: 'trash',
    })

    await expectPermissionDenied(
      executeDeleteForeverCommand(playerAuth, {
        campaignId: ctx.campaignDomainId,
        sourceItemIds: [folderId],
      }),
    )
  })

  it('allows player with full_access to permanently delete their trashed note', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'full_access',
    })

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'trash',
    })

    await executeDeleteForeverCommand(playerAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [noteId],
    })

    const deleted = await t.run(async (dbCtx) => dbCtx.db.get('sidebarItems', noteId))
    expect(deleted).toBeNull()
  })
})
