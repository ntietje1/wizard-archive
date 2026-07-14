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

  it('getBlocksWithShares returns not_shared with empty member permissions for unknown blockNoteIds', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteIds: [testBlockNoteId('unknown-1'), testBlockNoteId('unknown-2')],
    })

    expect(result.blocks).toHaveLength(2)
    for (const block of result.blocks) {
      expect(block.shareStatus).toBe('not_shared')
      expect(block.memberPermissions).toEqual({})
    }
  })

  it('getBlocksWithShares correctly aggregates shares across multiple blocks', async () => {
    const { dm, players, campaignId, campaignDomainId } = await setupMultiPlayerContext(t, 2)
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
      campaignId: campaignDomainId,
      noteId,
      blockNoteIds: [testBlockNoteId('agg-1'), testBlockNoteId('agg-2'), testBlockNoteId('agg-3')],
    })

    const block1 = result.blocks.find((b) => b.noteBlockId === testBlockNoteId('agg-1'))
    const block2 = result.blocks.find((b) => b.noteBlockId === testBlockNoteId('agg-2'))
    const block3 = result.blocks.find((b) => b.noteBlockId === testBlockNoteId('agg-3'))

    expect(block1!.memberPermissions).toEqual({
      [p1.memberDomainId]: 'view',
    })

    expect(block2!.memberPermissions).toEqual({
      [p2.memberDomainId]: 'view',
    })

    expect(block3!.memberPermissions).toEqual({
      [p1.memberDomainId]: 'view',
      [p2.memberDomainId]: 'view',
    })
  })

  it('getBlocksWithShares returns empty member permissions when no shares exist', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('no-shares'),
      shareStatus: 'individually_shared',
    })

    const result = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteIds: [testBlockNoteId('no-shares')],
    })

    const blockResult = result.blocks.find((b) => b.noteBlockId === testBlockNoteId('no-shares'))
    expect(blockResult!.memberPermissions).toEqual({})
  })

  it('getBlocksWithShares is only accessible by DM', async () => {
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
      playerAuth.query(api.blocks.queries.getBlocksWithShares, {
        campaignId: ctx.campaignDomainId,
        noteId,
        blockNoteIds: [testBlockNoteId('dm-only')],
      }),
    )
  })

  it('getBlocksWithShares returns all players and explicit member permissions', async () => {
    const { dm, players, campaignId, campaignDomainId } = await setupMultiPlayerContext(t, 2)
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

    const result = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
      campaignId: campaignDomainId,
      noteId,
      blockNoteIds: [testBlockNoteId('single-stale-share')],
    })

    expect(result.playerMembers.map((member) => member.id)).toEqual([
      eligiblePlayer.memberDomainId,
      ineligiblePlayer.memberDomainId,
    ])
    expect(result.notePermissionsByMemberId[eligiblePlayer.memberDomainId]).toBe('view')
    expect(result.notePermissionsByMemberId[ineligiblePlayer.memberDomainId]).toBe('none')
    expect(result.blocks[0]?.memberPermissions).toEqual({
      [eligiblePlayer.memberDomainId]: 'view',
      [ineligiblePlayer.memberDomainId]: 'view',
    })
  })

  it('getBlocksWithShares returns all playerMembers with note permissions', async () => {
    const { dm, players, campaignId, campaignDomainId } = await setupMultiPlayerContext(t, 3)
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
      campaignId: campaignDomainId,
      noteId,
      blockNoteIds: [],
    })

    expect(result.playerMembers).toHaveLength(3)
    const memberIds = result.playerMembers.map((m) => m.id)
    expect(memberIds).toContain(players[0].memberDomainId)
    expect(memberIds).toContain(players[1].memberDomainId)
    expect(memberIds).toContain(players[2].memberDomainId)
    expect(result.notePermissionsByMemberId[players[0].memberDomainId]).toBe('view')
    expect(result.notePermissionsByMemberId[players[1].memberDomainId]).toBe('view')
    expect(result.notePermissionsByMemberId[players[2].memberDomainId]).toBe('none')
  })

  it('getBlocksWithShares treats all-player note access as block share eligibility', async () => {
    const { dm, players, campaignId, campaignDomainId } = await setupMultiPlayerContext(t, 2)
    const dmAuth = dm.authed

    const { noteId } = await createNote(t, campaignId, dm.profile._id, {
      allPermissionLevel: 'view',
    })

    const result = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
      campaignId: campaignDomainId,
      noteId,
      blockNoteIds: [],
    })

    expect(result.playerMembers.map((m) => m.id)).toEqual(
      expect.arrayContaining(players.map((p) => p.memberDomainId)),
    )
  })

  it('getBlocksWithShares applies direct member permission before all-player note access', async () => {
    const { dm, players, campaignId, campaignDomainId } = await setupMultiPlayerContext(t, 2)
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
      campaignId: campaignDomainId,
      noteId,
      blockNoteIds: [testBlockNoteId('direct-none')],
    })

    expect(result.playerMembers.map((m) => m.id)).toEqual([
      deniedPlayer.memberDomainId,
      eligiblePlayer.memberDomainId,
    ])
    expect(result.notePermissionsByMemberId[deniedPlayer.memberDomainId]).toBe('none')
    expect(result.notePermissionsByMemberId[eligiblePlayer.memberDomainId]).toBe('view')
    expect(result.blocks[0]?.memberPermissions).toEqual({
      [deniedPlayer.memberDomainId]: 'view',
    })
  })

  it('getBlocksWithShares applies note all-player permission before inherited access', async () => {
    const { dm, players, campaignId, campaignDomainId } = await setupMultiPlayerContext(t, 1)
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
      campaignId: campaignDomainId,
      noteId,
      blockNoteIds: [testBlockNoteId('all-none')],
    })

    expect(result.playerMembers.map((m) => m.id)).toEqual([player.memberDomainId])
    expect(result.notePermissionsByMemberId[player.memberDomainId]).toBe('none')
    expect(result.blocks[0]?.memberPermissions).toEqual({
      [player.memberDomainId]: 'view',
    })
  })

  it('getBlocksWithShares includes explicit block shares for players without note access', async () => {
    const { dm, players, campaignId, campaignDomainId } = await setupMultiPlayerContext(t, 2)
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
      campaignId: campaignDomainId,
      noteId,
      blockNoteIds: [testBlockNoteId('stale-share')],
    })

    expect(result.playerMembers.map((m) => m.id)).toEqual([
      eligiblePlayer.memberDomainId,
      ineligiblePlayer.memberDomainId,
    ])
    expect(result.notePermissionsByMemberId[eligiblePlayer.memberDomainId]).toBe('view')
    expect(result.notePermissionsByMemberId[ineligiblePlayer.memberDomainId]).toBe('none')
    expect(result.blocks[0]?.memberPermissions).toEqual({
      [eligiblePlayer.memberDomainId]: 'view',
      [ineligiblePlayer.memberDomainId]: 'view',
    })
  })
})
