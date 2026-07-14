import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { createNoteViaFilesystem } from '../../_test/filesystemSetup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createNote, createSidebarShare } from '../../_test/factories.helper'
import { expectPermissionDenied, expectValidationFailed } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'
import {
  DOMAIN_ID_KIND,
  generateDomainId,
  isUuidV7,
} from '@wizard-archive/editor/resources/domain-id'

describe('edit history queries', () => {
  const t = createTestContext()

  it('projects UUIDv7 identities and rejects provider row IDs', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Canonical history note',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const historyEntry = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('editHistory')
        .withIndex('by_item_action', (q) => q.eq('itemId', noteId).eq('action', 'created'))
        .unique()
    })

    expect(historyEntry).not.toBeNull()
    expect(isUuidV7(historyEntry!.historyEntryUuid)).toBe(true)
    const projectedEntry = await dmAuth.query(api.editHistory.queries.getHistoryEntry, {
      campaignId: ctx.campaignDomainId,
      editHistoryId: historyEntry!.historyEntryUuid,
    })
    expect(projectedEntry).toMatchObject({
      id: historyEntry!.historyEntryUuid,
      createdAt: historyEntry!._creationTime,
    })
    expect(projectedEntry).not.toHaveProperty('_id')
    expect(projectedEntry).not.toHaveProperty('historyEntryUuid')
    await expectValidationFailed(
      dmAuth.query(api.editHistory.queries.getHistoryEntry, {
        campaignId: ctx.campaignDomainId,
        editHistoryId: historyEntry!._id as never,
      }),
    )
  })

  it('rejects direct history entry reads for view-only users', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
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
        campaignId: ctx.campaignDomainId,
        editHistoryId: historyEntry!.historyEntryUuid,
      }),
    )
  })

  it('rejects metadata that does not match the history action', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expect(
      t.run(async (dbCtx) =>
        dbCtx.db.insert('editHistory', {
          historyEntryUuid: generateDomainId(DOMAIN_ID_KIND.historyEntry),
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
