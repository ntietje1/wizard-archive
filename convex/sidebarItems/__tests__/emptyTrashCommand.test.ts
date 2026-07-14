import { executeTestFileSystemCommand } from '../../_test/filesystemCommand.helper'
import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createNote, executeMoveCommand } from '../../_test/factories.helper'
import { expectPermissionDenied } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('emptyTrash filesystem command', () => {
  const t = createTestContext()

  it('deletes all trash items', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: n1 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId: n2 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [n1, n2],
      targetParentId: null,
      action: 'trash',
    })

    await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: { type: 'emptyTrash' },
    })

    const { trash: trashItems } = await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignDomainId,
    })
    expect(trashItems.length).toBe(0)

    const d1 = await t.run(async (dbCtx) => dbCtx.db.get('sidebarItems', n1))
    const d2 = await t.run(async (dbCtx) => dbCtx.db.get('sidebarItems', n2))
    expect(d1).toBeNull()
    expect(d2).toBeNull()
  })

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    await expectPermissionDenied(
      executeTestFileSystemCommand(playerAuth, {
        campaignId: ctx.campaignDomainId,
        command: { type: 'emptyTrash' },
      }),
    )
  })
})
