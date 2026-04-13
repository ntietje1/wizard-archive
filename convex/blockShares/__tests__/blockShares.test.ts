import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import {
  asDm,
  asPlayer,
  setupCampaignContext,
  setupMultiPlayerContext,
} from '../../_test/identities.helper'
import {
  createBlock,
  createBlockShare,
  createNote,
  createSidebarShare,
  syncBlocksToYjs,
} from '../../_test/factories.helper'
import { expectNotFound, expectPermissionDenied } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'
import type { NoteWithContent } from '../../notes/types'

describe('setBlocksShareStatus', () => {
  const t = createTestContext()

  it('sets share status to all_shared', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id)
    await syncBlocksToYjs(t, noteId, [{ id: blockNoteId, type: 'paragraph' }])

    await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: [blockNoteId],
      status: 'all_shared',
    })

    const result = await dmAuth.query(api.blocks.queries.getBlockWithShares, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteId,
    })
    expect(result).not.toBeNull()
    expect(result!.shareStatus).toBe('all_shared')
  })

  it('sets share status to not_shared', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      shareStatus: 'all_shared',
    })
    await syncBlocksToYjs(t, noteId, [{ id: blockNoteId, type: 'paragraph' }])

    await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: [blockNoteId],
      status: 'not_shared',
    })

    const result = await dmAuth.query(api.blocks.queries.getBlockWithShares, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteId,
    })
    expect(result).not.toBeNull()
    expect(result!.shareStatus).toBe('not_shared')
  })

  it('sets share status to individually_shared', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id)
    await syncBlocksToYjs(t, noteId, [{ id: blockNoteId, type: 'paragraph' }])

    await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: [blockNoteId],
      status: 'individually_shared',
    })

    const result = await dmAuth.query(api.blocks.queries.getBlockWithShares, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteId,
    })
    expect(result).not.toBeNull()
    expect(result!.shareStatus).toBe('individually_shared')
  })

  it('throws NOT_FOUND when block does not exist', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotFound(
      dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
        campaignId: ctx.campaignId,
        noteId,
        blockNoteIds: ['nonexistent-block'],
        status: 'all_shared',
      }),
    )
  })

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectPermissionDenied(
      playerAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
        campaignId: ctx.campaignId,
        noteId,
        blockNoteIds: ['block-1'],
        status: 'all_shared',
      }),
    )
  })
})

describe('shareBlocks', () => {
  const t = createTestContext()

  it('shares a block with a member', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id)
    await syncBlocksToYjs(t, noteId, [{ id: blockNoteId, type: 'paragraph' }])

    await dmAuth.mutation(api.blockShares.mutations.shareBlocks, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: [blockNoteId],
      campaignMemberId: ctx.player.memberId,
    })

    const result = await dmAuth.query(api.blocks.queries.getBlockWithShares, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteId,
    })
    expect(result).not.toBeNull()
    expect(result!.shareStatus).toBe('individually_shared')
    expect(result!.shares).toHaveLength(1)
    expect(result!.shares[0].campaignMemberId).toBe(ctx.player.memberId)
  })

  it('throws NOT_FOUND when block does not exist', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotFound(
      dmAuth.mutation(api.blockShares.mutations.shareBlocks, {
        campaignId: ctx.campaignId,
        noteId,
        blockNoteIds: ['nonexistent-block'],
        campaignMemberId: ctx.player.memberId,
      }),
    )
  })

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectPermissionDenied(
      playerAuth.mutation(api.blockShares.mutations.shareBlocks, {
        campaignId: ctx.campaignId,
        noteId,
        blockNoteIds: ['block-1'],
        campaignMemberId: ctx.player.memberId,
      }),
    )
  })
})

describe('unshareBlocks', () => {
  const t = createTestContext()

  it('removes a block share', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockDbId, blockNoteId } = await createBlock(
      t,
      noteId,
      ctx.campaignId,
      ctx.dm.profile._id,
      { shareStatus: 'individually_shared' },
    )

    await createBlockShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      noteId,
      blockId: blockDbId,
      campaignMemberId: ctx.player.memberId,
    })

    await dmAuth.mutation(api.blockShares.mutations.unshareBlocks, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: [blockNoteId],
      campaignMemberId: ctx.player.memberId,
    })

    const result = await dmAuth.query(api.blocks.queries.getBlockWithShares, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteId,
    })
    expect(result === null || result.shares.length === 0).toBe(true)
  })

  it('reverts to not_shared when last share is removed', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockDbId, blockNoteId } = await createBlock(
      t,
      noteId,
      ctx.campaignId,
      ctx.dm.profile._id,
      { shareStatus: 'individually_shared' },
    )

    await createBlockShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      noteId,
      blockId: blockDbId,
      campaignMemberId: ctx.player.memberId,
    })

    await dmAuth.mutation(api.blockShares.mutations.unshareBlocks, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: [blockNoteId],
      campaignMemberId: ctx.player.memberId,
    })

    const result = await dmAuth.query(api.blocks.queries.getBlockWithShares, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteId,
    })
    expect(result).not.toBeNull()
    expect(result!.shareStatus).toBe('not_shared')
  })

  it('is a no-op when block does not exist', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.blockShares.mutations.unshareBlocks, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: ['nonexistent-block'],
      campaignMemberId: ctx.player.memberId,
    })

    const result = await dmAuth.query(api.blocks.queries.getBlockWithShares, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteId,
    })
    expect(result).not.toBeNull()
    expect(result!.shareStatus).toBe('not_shared')
  })

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectPermissionDenied(
      playerAuth.mutation(api.blockShares.mutations.unshareBlocks, {
        campaignId: ctx.campaignId,
        noteId,
        blockNoteIds: ['block-1'],
        campaignMemberId: ctx.player.memberId,
      }),
    )
  })
})

describe('getBlockShares', () => {
  const t = createTestContext()

  it('returns shares for a block', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockDbId } = await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      shareStatus: 'individually_shared',
    })

    await createBlockShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      noteId,
      blockId: blockDbId,
      campaignMemberId: ctx.player.memberId,
    })

    const shares = await dmAuth.query(api.blockShares.queries.getBlockShares, {
      campaignId: ctx.campaignId,
      blockId: blockDbId,
    })
    expect(shares).toHaveLength(1)
    expect(shares[0].campaignMemberId).toBe(ctx.player.memberId)
  })

  it('returns expected shape', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockDbId } = await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      shareStatus: 'individually_shared',
    })

    await createBlockShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      noteId,
      blockId: blockDbId,
      campaignMemberId: ctx.player.memberId,
    })

    const shares = await dmAuth.query(api.blockShares.queries.getBlockShares, {
      campaignId: ctx.campaignId,
      blockId: blockDbId,
    })
    expect(shares[0]).toHaveProperty('_id')
    expect(shares[0]).toHaveProperty('campaignId')
    expect(shares[0]).toHaveProperty('noteId')
    expect(shares[0]).toHaveProperty('blockId')
    expect(shares[0]).toHaveProperty('campaignMemberId')
  })

  it('excludes soft-deleted shares', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockDbId } = await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id)

    await createBlockShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      noteId,
      blockId: blockDbId,
      campaignMemberId: ctx.player.memberId,
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
    })

    const shares = await dmAuth.query(api.blockShares.queries.getBlockShares, {
      campaignId: ctx.campaignId,
      blockId: blockDbId,
    })
    expect(shares).toHaveLength(0)
  })
})

describe('block permission resolution', () => {
  const t = createTestContext()

  it('gives DM EDIT on any block', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      shareStatus: 'not_shared',
    })

    const result = await dmAuth.query(api.blocks.queries.getBlockWithShares, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteId,
    })
    expect(result).not.toBeNull()
    expect(result!.block).toBeTruthy()
  })

  it('gives player VIEW when block is all_shared and note is shared', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      shareStatus: 'all_shared',
    })

    const item = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: noteId,
    })
    expect(item).toBeTruthy()
    expect(item.myPermissionLevel).toBe('view')
  })

  it('hides not_shared block content from player', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      allPermissionLevel: 'view',
    })

    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      shareStatus: 'not_shared',
    })

    const item = (await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: noteId,
    })) as NoteWithContent
    expect(item).toBeTruthy()
    expect(item.blockMeta[blockNoteId]).toBeUndefined()
  })

  it('shows individually_shared block to shared player', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const { blockDbId, blockNoteId } = await createBlock(
      t,
      noteId,
      ctx.campaignId,
      ctx.dm.profile._id,
      { shareStatus: 'individually_shared' },
    )

    await createBlockShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      noteId,
      blockId: blockDbId,
      campaignMemberId: ctx.player.memberId,
    })

    const item = (await asPlayer(ctx).query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: noteId,
    })) as NoteWithContent
    expect(item).toBeTruthy()
    expect(item.blockMeta[blockNoteId]).toBeDefined()
    expect(item.blockMeta[blockNoteId].myPermissionLevel).toBe('view')
  })

  it('hides individually_shared block from non-shared player', async () => {
    const mCtx = await setupMultiPlayerContext(t, 2)
    const { noteId } = await createNote(t, mCtx.campaignId, mCtx.dm.profile._id)

    await createSidebarShare(t, mCtx.dm.profile._id, {
      campaignId: mCtx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: mCtx.players[0].memberId,
      permissionLevel: 'view',
    })

    await createSidebarShare(t, mCtx.dm.profile._id, {
      campaignId: mCtx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: mCtx.players[1].memberId,
      permissionLevel: 'view',
    })

    const { blockDbId, blockNoteId } = await createBlock(
      t,
      noteId,
      mCtx.campaignId,
      mCtx.dm.profile._id,
      { shareStatus: 'individually_shared' },
    )

    await createBlockShare(t, mCtx.dm.profile._id, {
      campaignId: mCtx.campaignId,
      noteId,
      blockId: blockDbId,
      campaignMemberId: mCtx.players[0].memberId,
    })

    const sharedPlayer = mCtx.players[0].authed
    const unsharedPlayer = mCtx.players[1].authed

    const sharedResult = (await sharedPlayer.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: mCtx.campaignId,
      id: noteId,
    })) as NoteWithContent
    expect(sharedResult).toBeTruthy()
    expect(sharedResult.blockMeta[blockNoteId]).toBeDefined()
    expect(sharedResult.blockMeta[blockNoteId].myPermissionLevel).toBe('view')

    const unsharedResult = (await unsharedPlayer.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: mCtx.campaignId,
      id: noteId,
    })) as NoteWithContent
    expect(unsharedResult).toBeTruthy()
    expect(unsharedResult.blockMeta[blockNoteId]).toBeUndefined()
  })
})
