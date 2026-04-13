import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { setupMultiPlayerContext } from '../../_test/identities.helper'
import {
  createBlock,
  createBlockShare,
  createBookmark,
  createNote,
  createSidebarShare,
  testBlockNoteId,
} from '../../_test/factories.helper'
import { expectPermissionDenied, expectValidationFailed } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('multi-player share + membership removal cascade', () => {
  const t = createTestContext()

  it('removed player loses access to all campaign content', async () => {
    const { dm, players, campaignId } = await setupMultiPlayerContext(t, 2)
    const dmAuth = dm.authed
    const p1 = players[0]
    const p2 = players[1]

    const { noteId } = await createNote(t, campaignId, dm.profile._id)
    await createSidebarShare(t, dm.profile._id, {
      campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: p1.memberId,
    })
    await createSidebarShare(t, dm.profile._id, {
      campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: p2.memberId,
    })

    await dmAuth.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId,
      memberId: p1.memberId,
      status: 'Removed',
    })

    const p1Campaigns = await p1.authed.query(api.campaigns.queries.getUserCampaigns, {})
    expect(p1Campaigns).toHaveLength(0)

    const p2Note = await p2.authed.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId,
      id: noteId,
    })
    expect(p2Note.myPermissionLevel).toBe('view')
  })

  it('shares and bookmarks remain in DB after member removal', async () => {
    const { dm, players, campaignId } = await setupMultiPlayerContext(t, 1)
    const dmAuth = dm.authed
    const p1 = players[0]

    const { noteId } = await createNote(t, campaignId, dm.profile._id)
    const { shareId } = await createSidebarShare(t, dm.profile._id, {
      campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: p1.memberId,
    })
    const { bookmarkId } = await createBookmark(t, p1.profile._id, {
      campaignId,
      sidebarItemId: noteId,
      campaignMemberId: p1.memberId,
    })

    await dmAuth.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId,
      memberId: p1.memberId,
      status: 'Removed',
    })

    const [share, bookmark] = await t.run(async (dbCtx) => [
      await dbCtx.db.get('sidebarItemShares', shareId),
      await dbCtx.db.get('bookmarks', bookmarkId),
    ])
    expect(share).not.toBeNull()
    expect(bookmark).not.toBeNull()
  })

  it('Removed status cannot transition to Accepted', async () => {
    const { dm, players, campaignId } = await setupMultiPlayerContext(t, 1)
    const dmAuth = dm.authed
    const p1 = players[0]

    await dmAuth.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId,
      memberId: p1.memberId,
      status: 'Removed',
    })

    await expectValidationFailed(
      dmAuth.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
        campaignId,
        memberId: p1.memberId,
        status: 'Accepted',
      }),
    )
  })

  it('block shares for removed player still exist but player cannot access note', async () => {
    const { dm, players, campaignId } = await setupMultiPlayerContext(t, 1)
    const dmAuth = dm.authed
    const p1 = players[0]

    const { noteId } = await createNote(t, campaignId, dm.profile._id)
    const { blockDbId } = await createBlock(t, noteId, campaignId, dm.profile._id, {
      blockNoteId: testBlockNoteId('secret'),
      shareStatus: 'individually_shared',
    })
    const { blockShareId } = await createBlockShare(t, dm.profile._id, {
      campaignId,
      noteId,
      blockId: blockDbId,
      campaignMemberId: p1.memberId,
    })
    await createSidebarShare(t, dm.profile._id, {
      campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: p1.memberId,
    })

    await dmAuth.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId,
      memberId: p1.memberId,
      status: 'Removed',
    })

    await expectPermissionDenied(p1.authed.query(api.notes.queries.getNote, { campaignId, noteId }))

    const blockShare = await t.run(async (dbCtx) => dbCtx.db.get('blockShares', blockShareId))
    expect(blockShare).not.toBeNull()
  })

  it('DM can still see all content after removing all players', async () => {
    const { dm, players, campaignId } = await setupMultiPlayerContext(t, 2)
    const dmAuth = dm.authed

    const { noteId } = await createNote(t, campaignId, dm.profile._id)

    await dmAuth.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId,
      memberId: players[0].memberId,
      status: 'Removed',
    })
    await dmAuth.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId,
      memberId: players[1].memberId,
      status: 'Removed',
    })

    const items = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByLocation, {
      campaignId,
      location: 'sidebar',
    })
    const noteItem = items.find((i) => i._id === noteId)
    expect(noteItem).toBeDefined()
  })
})
