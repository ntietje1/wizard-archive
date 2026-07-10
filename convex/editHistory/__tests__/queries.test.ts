import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { createNoteViaFilesystem } from '../../_test/filesystemSetup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createNote, createSidebarShare } from '../../_test/factories.helper'
import { expectPermissionDenied } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('edit history queries', () => {
  const t = createTestContext()

  it('rejects direct history entry reads for view-only users', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Shared history note',
      parentTarget: { kind: 'direct', parentId: null },
    })
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const historyEntry = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('editHistory')
        .withIndex('by_item_action', (q) => q.eq('itemId', noteId).eq('action', 'created'))
        .first()
    })
    expect(historyEntry).not.toBeNull()

    await expectPermissionDenied(
      playerAuth.query(api.editHistory.queries.getHistoryEntry, {
        campaignId: ctx.campaignId,
        editHistoryId: historyEntry!._id,
      }),
    )
  })

  it('rejects metadata that does not match the history action', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expect(
      t.run(async (dbCtx) =>
        dbCtx.db.insert('editHistory', {
          itemId: noteId,
          itemType: 'note',
          campaignId: ctx.campaignId,
          campaignMemberId: ctx.dm.memberId,
          action: 'copied',
          metadata: null,
          hasSnapshot: false,
        } as never),
      ),
    ).rejects.toThrow('Validator error')
  })
})
