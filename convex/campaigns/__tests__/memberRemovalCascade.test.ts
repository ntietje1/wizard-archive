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
import { expectPermissionDenied } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('multi-player share + membership removal cascade', () => {
  const t = createTestContext()

  it('removed player loses access to all campaign content', async () => {
    const { dm, players, campaignId, campaignDomainId } = await setupMultiPlayerContext(t, 2)
    const dmAuth = dm.authed
    const p1 = players[0]
    const p2 = players[1]

    const { noteId } = await createNote(t, campaignId, dm.profile._id)
    await createSidebarShare(t, {
      campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: p1.memberId,
    })
    await createSidebarShare(t, {
      campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: p2.memberId,
    })

    await dmAuth.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId: campaignDomainId,
      memberId: p1.memberDomainId,
      status: 'Removed',
    })

    const p1Campaigns = await p1.authed.query(api.campaigns.queries.getUserCampaigns, {})
    expect(p1Campaigns).toHaveLength(0)

    const p2Note = await p2.authed.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: campaignDomainId,
      id: noteId,
    })
    expect(p2Note.myPermissionLevel).toBe('view')
  })

  it('shares and bookmarks remain in DB after member removal', async () => {
    const { dm, players, campaignId, campaignDomainId } = await setupMultiPlayerContext(t, 1)
    const dmAuth = dm.authed
    const p1 = players[0]

    const { noteId } = await createNote(t, campaignId, dm.profile._id)
    const { shareId } = await createSidebarShare(t, {
      campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: p1.memberId,
    })
    const { bookmarkId } = await createBookmark(t, {
      campaignId,
      sidebarItemId: noteId,
      campaignMemberId: p1.memberId,
    })

    await dmAuth.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId: campaignDomainId,
      memberId: p1.memberDomainId,
      status: 'Removed',
    })

    const [share, bookmark] = await t.run(async (dbCtx) => [
      await dbCtx.db.get('sidebarItemShares', shareId),
      await dbCtx.db.get('bookmarks', bookmarkId),
    ])
    expect(share).not.toBeNull()
    expect(bookmark).not.toBeNull()
  })

  it('restores a removed player to accepted membership', async () => {
    const { dm, players, campaignDomainId } = await setupMultiPlayerContext(t, 1)
    const dmAuth = dm.authed
    const p1 = players[0]

    await dmAuth.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId: campaignDomainId,
      memberId: p1.memberDomainId,
      status: 'Removed',
    })

    await dmAuth.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId: campaignDomainId,
      memberId: p1.memberDomainId,
      status: 'Accepted',
    })

    const campaigns = await p1.authed.query(api.campaigns.queries.getUserCampaigns, {})
    expect(campaigns.map((campaign) => campaign.id)).toContain(campaignDomainId)
  })

  it('block shares for removed player still exist but player cannot access note', async () => {
    const { dm, players, campaignId, campaignDomainId } = await setupMultiPlayerContext(t, 1)
    const dmAuth = dm.authed
    const p1 = players[0]

    const { noteId } = await createNote(t, campaignId, dm.profile._id)
    const { blockDbId } = await createBlock(t, noteId, campaignId, {
      blockNoteId: testBlockNoteId('secret'),
      shareStatus: 'individually_shared',
    })
    const { blockShareId } = await createBlockShare(t, {
      campaignId,
      noteId,
      blockId: blockDbId,
      campaignMemberId: p1.memberId,
    })
    await createSidebarShare(t, {
      campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: p1.memberId,
    })

    await dmAuth.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId: campaignDomainId,
      memberId: p1.memberDomainId,
      status: 'Removed',
    })

    await expectPermissionDenied(
      p1.authed.query(api.notes.queries.getNote, { campaignId: campaignDomainId, noteId }),
    )

    const blockShare = await t.run(async (dbCtx) => dbCtx.db.get('blockShares', blockShareId))
    expect(blockShare).not.toBeNull()
  })

  it('DM can still see all content after removing all players', async () => {
    const { dm, players, campaignId, campaignDomainId } = await setupMultiPlayerContext(t, 2)
    const dmAuth = dm.authed

    const { noteId } = await createNote(t, campaignId, dm.profile._id)

    await dmAuth.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId: campaignDomainId,
      memberId: players[0].memberDomainId,
      status: 'Removed',
    })
    await dmAuth.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId: campaignDomainId,
      memberId: players[1].memberDomainId,
      status: 'Removed',
    })

    const { active: items } = await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: campaignDomainId,
    })
    const noteItem = items.find((i) => i.id === noteId)
    expect(noteItem).toBeDefined()
  })
})
