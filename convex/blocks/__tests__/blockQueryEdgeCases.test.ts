import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext, setupMultiPlayerContext } from '../../_test/identities.helper'
import {
  createBlock,
  createBlockShare,
  createFolder,
  createNote,
  createSidebarShare,
  testBlockNoteId,
} from '../../_test/factories.helper'
import { expectPermissionDenied } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('block query edge cases', () => {
  const t = createTestContext()

  it('getBlockWithShares returns null for non-existent blockNoteId', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.query(api.blocks.queries.getBlockWithShares, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteId: testBlockNoteId('nonexistent-block'),
    })
    expect(result).toBeNull()
  })

  it('getBlocksWithShares returns not_shared with empty sharedMemberIds for unknown blockNoteIds', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: [testBlockNoteId('unknown-1'), testBlockNoteId('unknown-2')],
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
    const b1 = await createBlock(t, noteId, campaignId, {
      blockNoteId: testBlockNoteId('agg-1'),
      shareStatus: 'individually_shared',
    })
    const b2 = await createBlock(t, noteId, campaignId, {
      blockNoteId: testBlockNoteId('agg-2'),
      shareStatus: 'individually_shared',
    })
    const b3 = await createBlock(t, noteId, campaignId, {
      blockNoteId: testBlockNoteId('agg-3'),
      shareStatus: 'individually_shared',
    })

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

    await createBlockShare(t, {
      campaignId,
      noteId,
      blockId: b1.blockDbId,
      campaignMemberId: p1.memberId,
    })
    await createBlockShare(t, {
      campaignId,
      noteId,
      blockId: b2.blockDbId,
      campaignMemberId: p2.memberId,
    })
    await createBlockShare(t, {
      campaignId,
      noteId,
      blockId: b3.blockDbId,
      campaignMemberId: p1.memberId,
    })
    await createBlockShare(t, {
      campaignId,
      noteId,
      blockId: b3.blockDbId,
      campaignMemberId: p2.memberId,
    })

    const result = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
      campaignId,
      noteId,
      blockNoteIds: [testBlockNoteId('agg-1'), testBlockNoteId('agg-2'), testBlockNoteId('agg-3')],
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

  it('getBlocksWithShares returns empty sharedMemberIds when no shares exist', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('no-shares'),
      shareStatus: 'individually_shared',
    })

    const result = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: [testBlockNoteId('no-shares')],
    })

    const blockResult = result.blocks.find((b) => b.blockNoteId === testBlockNoteId('no-shares'))
    expect(blockResult!.sharedMemberIds).toHaveLength(0)
  })

  it('getBlockWithShares is only accessible by DM', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = ctx.player.authed

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })
    await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('dm-only'),
    })

    await expectPermissionDenied(
      playerAuth.query(api.blocks.queries.getBlockWithShares, {
        campaignId: ctx.campaignId,
        noteId,
        blockNoteId: testBlockNoteId('dm-only'),
      }),
    )
  })

  it('getBlockWithShares returns only note-eligible players and shares', async () => {
    const { dm, players, campaignId } = await setupMultiPlayerContext(t, 2)
    const dmAuth = dm.authed
    const eligiblePlayer = players[0]
    const ineligiblePlayer = players[1]

    const { noteId } = await createNote(t, campaignId, dm.profile._id)
    const block = await createBlock(t, noteId, campaignId, {
      blockNoteId: testBlockNoteId('single-stale-share'),
      shareStatus: 'individually_shared',
    })

    await createSidebarShare(t, {
      campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: eligiblePlayer.memberId,
    })
    await createBlockShare(t, {
      campaignId,
      noteId,
      blockId: block.blockDbId,
      campaignMemberId: eligiblePlayer.memberId,
    })
    await createBlockShare(t, {
      campaignId,
      noteId,
      blockId: block.blockDbId,
      campaignMemberId: ineligiblePlayer.memberId,
    })

    const result = await dmAuth.query(api.blocks.queries.getBlockWithShares, {
      campaignId,
      noteId,
      blockNoteId: testBlockNoteId('single-stale-share'),
    })

    expect(result).not.toBeNull()
    expect(result!.playerMembers.map((m) => m._id)).toEqual([eligiblePlayer.memberId])
    expect(result!.shares.map((share) => share.campaignMemberId)).toEqual([eligiblePlayer.memberId])
  })

  it('getBlocksWithShares returns only note-eligible playerMembers', async () => {
    const { dm, players, campaignId } = await setupMultiPlayerContext(t, 3)
    const dmAuth = dm.authed

    const { noteId } = await createNote(t, campaignId, dm.profile._id)
    await createSidebarShare(t, {
      campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: players[0].memberId,
    })
    await createSidebarShare(t, {
      campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: players[1].memberId,
    })

    const result = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
      campaignId,
      noteId,
      blockNoteIds: [],
    })

    expect(result.playerMembers).toHaveLength(2)
    const memberIds = result.playerMembers.map((m) => m._id)
    expect(memberIds).toContain(players[0].memberId)
    expect(memberIds).toContain(players[1].memberId)
    expect(memberIds).not.toContain(players[2].memberId)
  })

  it('getBlocksWithShares treats all-player note access as block share eligibility', async () => {
    const { dm, players, campaignId } = await setupMultiPlayerContext(t, 2)
    const dmAuth = dm.authed

    const { noteId } = await createNote(t, campaignId, dm.profile._id, {
      allPermissionLevel: 'view',
    })

    const result = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
      campaignId,
      noteId,
      blockNoteIds: [],
    })

    expect(result.playerMembers.map((m) => m._id)).toEqual(
      expect.arrayContaining(players.map((p) => p.memberId)),
    )
  })

  it('getBlocksWithShares applies direct member permission before all-player note access', async () => {
    const { dm, players, campaignId } = await setupMultiPlayerContext(t, 2)
    const dmAuth = dm.authed
    const deniedPlayer = players[0]
    const eligiblePlayer = players[1]

    const { noteId } = await createNote(t, campaignId, dm.profile._id, {
      allPermissionLevel: 'view',
    })
    const block = await createBlock(t, noteId, campaignId, {
      blockNoteId: testBlockNoteId('direct-none'),
      shareStatus: 'individually_shared',
    })

    await createSidebarShare(t, {
      campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: deniedPlayer.memberId,
      permissionLevel: 'none',
    })
    await createBlockShare(t, {
      campaignId,
      noteId,
      blockId: block.blockDbId,
      campaignMemberId: deniedPlayer.memberId,
    })

    const result = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
      campaignId,
      noteId,
      blockNoteIds: [testBlockNoteId('direct-none')],
    })

    expect(result.playerMembers.map((m) => m._id)).toEqual([eligiblePlayer.memberId])
    expect(result.blocks[0]?.sharedMemberIds).toEqual([])
  })

  it('getBlocksWithShares applies note all-player permission before inherited access', async () => {
    const { dm, players, campaignId } = await setupMultiPlayerContext(t, 1)
    const dmAuth = dm.authed
    const player = players[0]

    const { folderId } = await createFolder(t, campaignId, dm.profile._id, {
      allPermissionLevel: 'view',
    })
    const { noteId } = await createNote(t, campaignId, dm.profile._id, {
      parentId: folderId,
      allPermissionLevel: 'none',
    })
    const block = await createBlock(t, noteId, campaignId, {
      blockNoteId: testBlockNoteId('all-none'),
      shareStatus: 'individually_shared',
    })
    await createBlockShare(t, {
      campaignId,
      noteId,
      blockId: block.blockDbId,
      campaignMemberId: player.memberId,
    })

    const result = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
      campaignId,
      noteId,
      blockNoteIds: [testBlockNoteId('all-none')],
    })

    expect(result.playerMembers).toEqual([])
    expect(result.blocks[0]?.sharedMemberIds).toEqual([])
  })

  it('getBlocksWithShares ignores stale block shares for players without note access', async () => {
    const { dm, players, campaignId } = await setupMultiPlayerContext(t, 2)
    const dmAuth = dm.authed
    const eligiblePlayer = players[0]
    const ineligiblePlayer = players[1]

    const { noteId } = await createNote(t, campaignId, dm.profile._id)
    const block = await createBlock(t, noteId, campaignId, {
      blockNoteId: testBlockNoteId('stale-share'),
      shareStatus: 'individually_shared',
    })

    await createSidebarShare(t, {
      campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: eligiblePlayer.memberId,
    })
    await createBlockShare(t, {
      campaignId,
      noteId,
      blockId: block.blockDbId,
      campaignMemberId: eligiblePlayer.memberId,
    })
    await createBlockShare(t, {
      campaignId,
      noteId,
      blockId: block.blockDbId,
      campaignMemberId: ineligiblePlayer.memberId,
    })

    const result = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
      campaignId,
      noteId,
      blockNoteIds: [testBlockNoteId('stale-share')],
    })

    expect(result.playerMembers.map((m) => m._id)).toEqual([eligiblePlayer.memberId])
    expect(result.blocks[0]?.sharedMemberIds).toEqual([eligiblePlayer.memberId])
  })
})
