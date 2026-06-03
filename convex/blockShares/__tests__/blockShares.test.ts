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
import { getBlockShareInfo } from '../../_test/blockShareQueries.helper'
import { api } from '../../_generated/api'
import type { NoteWithContent } from '../../../shared/notes/types'

describe('setBlocksShareStatus', () => {
  const t = createTestContext()

  it('sets share status to all_shared', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId)
    await syncBlocksToYjs(t, noteId, [{ id: blockNoteId, type: 'paragraph' }])
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await dmAuth.action(api.blockShares.actions.setBlocksShareStatus, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: [blockNoteId],
      status: 'all_shared',
    })

    const result = await getBlockShareInfo(dmAuth, {
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
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId, {
      shareStatus: 'all_shared',
    })
    await syncBlocksToYjs(t, noteId, [{ id: blockNoteId, type: 'paragraph' }])

    await dmAuth.action(api.blockShares.actions.setBlocksShareStatus, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: [blockNoteId],
      status: 'not_shared',
    })

    const result = await getBlockShareInfo(dmAuth, {
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
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId)
    await syncBlocksToYjs(t, noteId, [{ id: blockNoteId, type: 'paragraph' }])

    await dmAuth.action(api.blockShares.actions.setBlocksShareStatus, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: [blockNoteId],
      status: 'individually_shared',
    })

    const result = await getBlockShareInfo(dmAuth, {
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
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await expectNotFound(
      dmAuth.action(api.blockShares.actions.setBlocksShareStatus, {
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
      playerAuth.action(api.blockShares.actions.setBlocksShareStatus, {
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
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId)
    await syncBlocksToYjs(t, noteId, [{ id: blockNoteId, type: 'paragraph' }])
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await dmAuth.action(api.blockShares.actions.shareBlocks, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: [blockNoteId],
      campaignMemberId: ctx.player.memberId,
    })

    const result = await getBlockShareInfo(dmAuth, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteId,
    })
    expect(result).not.toBeNull()
    expect(result!.shareStatus).toBe('individually_shared')
    expect(result!.memberPermissions[ctx.player.memberId]).toBe('view')
  })

  it('shares a block with a member before they can view the note', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId)
    await syncBlocksToYjs(t, noteId, [{ id: blockNoteId, type: 'paragraph' }])

    await dmAuth.action(api.blockShares.actions.shareBlocks, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: [blockNoteId],
      campaignMemberId: ctx.player.memberId,
    })

    const dmResult = await getBlockShareInfo(dmAuth, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteId,
    })
    expect(dmResult).not.toBeNull()
    expect(dmResult!.shareStatus).toBe('individually_shared')
    expect(dmResult!.memberPermissions[ctx.player.memberId]).toBe('view')

    const playerNote = await playerAuth.query(api.notes.queries.getNote, {
      campaignId: ctx.campaignId,
      noteId,
    })
    expect(playerNote).toBeNull()
  })

  it('throws NOT_FOUND when block does not exist', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await expectNotFound(
      dmAuth.action(api.blockShares.actions.shareBlocks, {
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
      playerAuth.action(api.blockShares.actions.shareBlocks, {
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
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId)
    await syncBlocksToYjs(t, noteId, [{ id: blockNoteId, type: 'paragraph' }])
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })
    await dmAuth.action(api.blockShares.actions.shareBlocks, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: [blockNoteId],
      campaignMemberId: ctx.player.memberId,
    })

    await dmAuth.action(api.blockShares.actions.unshareBlocks, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: [blockNoteId],
      campaignMemberId: ctx.player.memberId,
    })

    const result = await getBlockShareInfo(dmAuth, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteId,
    })
    expect(result).not.toBeNull()
    expect(result!.memberPermissions).toEqual({})
  })

  it('reverts to not_shared when last share is removed', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId)
    await syncBlocksToYjs(t, noteId, [{ id: blockNoteId, type: 'paragraph' }])
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })
    await dmAuth.action(api.blockShares.actions.shareBlocks, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: [blockNoteId],
      campaignMemberId: ctx.player.memberId,
    })

    await dmAuth.action(api.blockShares.actions.unshareBlocks, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: [blockNoteId],
      campaignMemberId: ctx.player.memberId,
    })

    const result = await getBlockShareInfo(dmAuth, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteId,
    })
    expect(result).not.toBeNull()
    expect(result!.shareStatus).toBe('not_shared')
    expect(result!.memberPermissions).toEqual({})
  })

  it('is a no-op when block does not exist', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId)
    await syncBlocksToYjs(t, noteId, [{ id: blockNoteId, type: 'paragraph' }])

    await dmAuth.action(api.blockShares.actions.unshareBlocks, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: ['nonexistent-block'],
      campaignMemberId: ctx.player.memberId,
    })

    const result = await getBlockShareInfo(dmAuth, {
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
      playerAuth.action(api.blockShares.actions.unshareBlocks, {
        campaignId: ctx.campaignId,
        noteId,
        blockNoteIds: ['block-1'],
        campaignMemberId: ctx.player.memberId,
      }),
    )
  })
})

describe('block permission resolution', () => {
  const t = createTestContext()

  it('gives DM EDIT on any block', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId, {
      shareStatus: 'not_shared',
    })

    const result = await getBlockShareInfo(dmAuth, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteId,
    })
    expect(result).toBeDefined()
  })

  it('gives player VIEW when block is all_shared and note is shared', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await createBlock(t, noteId, ctx.campaignId, {
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

    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId, {
      shareStatus: 'not_shared',
    })

    const item = (await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: noteId,
    })) as NoteWithContent
    expect(item).toBeTruthy()
    expect(item.blockMeta[blockNoteId]).toBeUndefined()
  })

  it('treats nullable block share status as not shared for players', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      allPermissionLevel: 'view',
    })

    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId, {
      shareStatus: null,
    })

    const item = (await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: noteId,
    })) as NoteWithContent
    expect(item).toBeTruthy()
    expect(item.blockMeta[blockNoteId]).toBeUndefined()
  })

  it('allows DM to access nullable block share status as not shared', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId, {
      shareStatus: null,
    })

    const result = await getBlockShareInfo(dmAuth, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteId,
    })
    expect(result).toBeDefined()
    expect(result!.shareStatus).toBe('not_shared')
  })

  it('shows individually_shared block to shared player', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const { blockDbId, blockNoteId } = await createBlock(t, noteId, ctx.campaignId, {
      shareStatus: 'individually_shared',
    })

    await createBlockShare(t, {
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

  it('lets DM explicitly share a block before the player can view the note', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId)
    await syncBlocksToYjs(t, noteId, [{ id: blockNoteId, type: 'paragraph' }])

    await dmAuth.action(api.blockShares.actions.setBlockMemberPermission, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: [blockNoteId],
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const dmResult = await getBlockShareInfo(dmAuth, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteId,
    })
    expect(dmResult).not.toBeNull()
    expect(dmResult!.memberPermissions[ctx.player.memberId]).toBe('view')

    const playerResult = await playerAuth.query(api.notes.queries.getNote, {
      campaignId: ctx.campaignId,
      noteId,
    })
    expect(playerResult).toBeNull()
  })

  it('does not log history for empty member permission updates', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.action(api.blockShares.actions.setBlockMemberPermission, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: [],
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const history = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('editHistory')
        .withIndex('by_item_action', (q) =>
          q.eq('itemId', noteId).eq('action', 'block_share_changed'),
        )
        .collect()
    })
    expect(history).toEqual([])
  })

  it('shows DM a note-level warning for explicit block shares whose players cannot view the note', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId)
    await syncBlocksToYjs(t, noteId, [{ id: blockNoteId, type: 'paragraph' }])

    await dmAuth.action(api.blockShares.actions.setBlockMemberPermission, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: [blockNoteId],
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const dmNote = (await dmAuth.query(api.notes.queries.getNote, {
      campaignId: ctx.campaignId,
      noteId,
    })) as NoteWithContent
    expect(dmNote.blockShareAccessWarnings).toEqual([
      {
        campaignMemberId: ctx.player.memberId,
        blockCount: 1,
      },
    ])

    await dmAuth.action(api.blockShares.actions.setBlocksShareStatus, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: [blockNoteId],
      status: 'not_shared',
    })

    const dmNoteWithHiddenAllPlayers = (await dmAuth.query(api.notes.queries.getNote, {
      campaignId: ctx.campaignId,
      noteId,
    })) as NoteWithContent
    expect(dmNoteWithHiddenAllPlayers.blockShareAccessWarnings).toEqual([
      {
        campaignMemberId: ctx.player.memberId,
        blockCount: 1,
      },
    ])
  })

  it('does not warn for explicit block shares targeting inactive legacy members', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockDbId, blockNoteId } = await createBlock(t, noteId, ctx.campaignId, {
      shareStatus: 'individually_shared',
    })
    await syncBlocksToYjs(t, noteId, [{ id: blockNoteId, type: 'paragraph' }])
    await createBlockShare(t, {
      campaignId: ctx.campaignId,
      noteId,
      blockId: blockDbId,
      campaignMemberId: ctx.player.memberId,
    })
    await t.run(async (dbCtx) => {
      await dbCtx.db.patch(ctx.player.memberId, { status: 'Removed' })
    })

    const dmNote = (await dmAuth.query(api.notes.queries.getNote, {
      campaignId: ctx.campaignId,
      noteId,
    })) as NoteWithContent
    expect(dmNote.blockShareAccessWarnings).toEqual([])
  })

  it('clears stale member block permissions for inactive members', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockDbId, blockNoteId } = await createBlock(t, noteId, ctx.campaignId, {
      shareStatus: 'individually_shared',
    })
    await syncBlocksToYjs(t, noteId, [{ id: blockNoteId, type: 'paragraph' }])
    await createBlockShare(t, {
      campaignId: ctx.campaignId,
      noteId,
      blockId: blockDbId,
      campaignMemberId: ctx.player.memberId,
    })
    await t.run(async (dbCtx) => {
      await dbCtx.db.patch(ctx.player.memberId, { status: 'Removed' })
    })

    await dmAuth.action(api.blockShares.actions.setBlockMemberPermission, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: [blockNoteId],
      campaignMemberId: ctx.player.memberId,
      permissionLevel: null,
    })

    const blockInfo = await getBlockShareInfo(dmAuth, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteId,
    })
    expect(blockInfo?.memberPermissions).toEqual({})
  })

  it('does not expose other players block share metadata to player note reads', async () => {
    const mCtx = await setupMultiPlayerContext(t, 2)
    const p1 = mCtx.players[0]
    const p2 = mCtx.players[1]
    const { noteId } = await createNote(t, mCtx.campaignId, mCtx.dm.profile._id)
    const { blockDbId, blockNoteId } = await createBlock(t, noteId, mCtx.campaignId, {
      shareStatus: 'all_shared',
    })

    await createSidebarShare(t, {
      campaignId: mCtx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: p1.memberId,
      permissionLevel: 'view',
    })
    await createBlockShare(t, {
      campaignId: mCtx.campaignId,
      noteId,
      blockId: blockDbId,
      campaignMemberId: p2.memberId,
    })

    const playerNote = (await p1.authed.query(api.notes.queries.getNote, {
      campaignId: mCtx.campaignId,
      noteId,
    })) as NoteWithContent
    expect(playerNote.blockMeta[blockNoteId]).toBeDefined()
    expect(playerNote.blockMeta[blockNoteId].sharedWith).toEqual([])
    expect(playerNote.blockMeta[blockNoteId].hiddenFrom).toEqual([])
  })

  it('hides individually_shared block from non-shared player', async () => {
    const mCtx = await setupMultiPlayerContext(t, 2)
    const { noteId } = await createNote(t, mCtx.campaignId, mCtx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: mCtx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: mCtx.players[0].memberId,
      permissionLevel: 'view',
    })

    await createSidebarShare(t, {
      campaignId: mCtx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: mCtx.players[1].memberId,
      permissionLevel: 'view',
    })

    const { blockDbId, blockNoteId } = await createBlock(t, noteId, mCtx.campaignId, {
      shareStatus: 'individually_shared',
    })

    await createBlockShare(t, {
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

  it('hides all_shared block from player with explicit hidden block override', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      allPermissionLevel: 'view',
    })
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId, {
      shareStatus: 'all_shared',
    })
    await syncBlocksToYjs(t, noteId, [{ id: blockNoteId, type: 'paragraph' }])

    await dmAuth.action(api.blockShares.actions.setBlockMemberPermission, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: [blockNoteId],
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'none',
    })

    const playerResult = (await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: noteId,
    })) as NoteWithContent
    expect(playerResult).toBeTruthy()
    expect(playerResult.blockMeta[blockNoteId]).toBeUndefined()

    const dmResult = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
      campaignId: ctx.campaignId,
      noteId,
      blockNoteIds: [blockNoteId],
    })
    expect(dmResult.blocks[0]?.shareStatus).toBe('all_shared')
    expect(dmResult.blocks[0]?.memberPermissions[ctx.player.memberId]).toBe('none')
  })

  it('shows every block to player with edit note permission', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId, {
      shareStatus: 'not_shared',
    })

    const item = (await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: noteId,
    })) as NoteWithContent
    expect(item).toBeTruthy()
    expect(item.blockMeta[blockNoteId]).toBeDefined()
    expect(item.blockMeta[blockNoteId].myPermissionLevel).toBe('view')
  })
})
