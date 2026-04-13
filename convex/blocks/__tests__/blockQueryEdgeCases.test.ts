import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext, setupMultiPlayerContext } from '../../_test/identities.helper'
import {
  createBlock,
  createBlockShare,
  createNote,
  createSidebarShare,
  testBlockNoteId,
} from '../../_test/factories.helper'
import { expectPermissionDenied } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('block query edge cases', () => {
  const t = createTestContext()

  it('getBlockWithShares returns null for non-existent blockId', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.query(api.blocks.queries.getBlockWithShares, {
      campaignId: ctx.campaignId,
      noteId,
      blockId: testBlockNoteId('nonexistent-block'),
    })
    expect(result).toBeNull()
  })

  it('getBlocksWithShares returns not_shared with empty sharedMemberIds for unknown blockIds', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
      campaignId: ctx.campaignId,
      noteId,
      blockIds: [testBlockNoteId('unknown-1'), testBlockNoteId('unknown-2')],
    })

    expect(result.blocks).toHaveLength(2)
    for (const block of result.blocks) {
      expect(block.shareStatus).toBe('not_shared')
      expect(block.sharedMemberIds).toEqual([])
    }
  })

  it('getBlocksWithShares correctly aggregates shares across multiple blocks', async () => {
    const { dm, players, campaignId } = await setupMultiPlayerContext(t, 2)
    const dmAuth = dm.authed
    const p1 = players[0]
    const p2 = players[1]

    const { noteId } = await createNote(t, campaignId, dm.profile._id)
    const b1 = await createBlock(t, noteId, campaignId, dm.profile._id, {
      blockId: testBlockNoteId('agg-1'),
      shareStatus: 'individually_shared',
    })
    const b2 = await createBlock(t, noteId, campaignId, dm.profile._id, {
      blockId: testBlockNoteId('agg-2'),
      shareStatus: 'individually_shared',
    })
    const b3 = await createBlock(t, noteId, campaignId, dm.profile._id, {
      blockId: testBlockNoteId('agg-3'),
      shareStatus: 'individually_shared',
    })

    await createBlockShare(t, dm.profile._id, {
      campaignId,
      noteId,
      blockId: b1.blockDbId,
      campaignMemberId: p1.memberId,
    })
    await createBlockShare(t, dm.profile._id, {
      campaignId,
      noteId,
      blockId: b2.blockDbId,
      campaignMemberId: p2.memberId,
    })
    await createBlockShare(t, dm.profile._id, {
      campaignId,
      noteId,
      blockId: b3.blockDbId,
      campaignMemberId: p1.memberId,
    })
    await createBlockShare(t, dm.profile._id, {
      campaignId,
      noteId,
      blockId: b3.blockDbId,
      campaignMemberId: p2.memberId,
    })

    const result = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
      campaignId,
      noteId,
      blockIds: [testBlockNoteId('agg-1'), testBlockNoteId('agg-2'), testBlockNoteId('agg-3')],
    })

    const block1 = result.blocks.find((b) => b.blockNoteId === testBlockNoteId('agg-1'))
    const block2 = result.blocks.find((b) => b.blockNoteId === testBlockNoteId('agg-2'))
    const block3 = result.blocks.find((b) => b.blockNoteId === testBlockNoteId('agg-3'))

    expect(block1!.sharedMemberIds).toHaveLength(1)
    expect(block1!.sharedMemberIds).toContain(p1.memberId)

    expect(block2!.sharedMemberIds).toHaveLength(1)
    expect(block2!.sharedMemberIds).toContain(p2.memberId)

    expect(block3!.sharedMemberIds).toHaveLength(2)
    expect(block3!.sharedMemberIds).toContain(p1.memberId)
    expect(block3!.sharedMemberIds).toContain(p2.memberId)
  })

  it('getBlocksWithShares excludes soft-deleted blockShares', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const block = await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockId: testBlockNoteId('soft-del'),
      shareStatus: 'individually_shared',
    })
    await createBlockShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      noteId,
      blockId: block.blockDbId,
      campaignMemberId: ctx.player.memberId,
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
    })

    const result = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
      campaignId: ctx.campaignId,
      noteId,
      blockIds: [testBlockNoteId('soft-del')],
    })

    const blockResult = result.blocks.find((b) => b.blockNoteId === testBlockNoteId('soft-del'))
    expect(blockResult!.sharedMemberIds).toHaveLength(0)
  })

  it('getBlockWithShares is only accessible by DM', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = ctx.player.authed

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })
    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockId: testBlockNoteId('dm-only'),
    })

    await expectPermissionDenied(
      playerAuth.query(api.blocks.queries.getBlockWithShares, {
        campaignId: ctx.campaignId,
        noteId,
        blockId: testBlockNoteId('dm-only'),
      }),
    )
  })

  it('getBlocksWithShares returns playerMembers list', async () => {
    const { dm, players, campaignId } = await setupMultiPlayerContext(t, 3)
    const dmAuth = dm.authed

    const { noteId } = await createNote(t, campaignId, dm.profile._id)

    const result = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
      campaignId,
      noteId,
      blockIds: [],
    })

    expect(result.playerMembers).toHaveLength(3)
    const memberIds = result.playerMembers.map((m) => m._id)
    for (const p of players) {
      expect(memberIds).toContain(p.memberId)
    }
  })
})
