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
  testBlockNoteId,
} from '../../_test/factories.helper'
import {
  expectNotFound,
  expectPermissionDenied,
  expectValidationFailed,
} from '../../_test/assertions.helper'
import { getBlockShareInfo } from '../../_test/blockShareQueries.helper'
import { api } from '../../_generated/api'
import type { NoteItemWithContent } from '@wizard-archive/editor/notes/item-contract'

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

    const receipt = await dmAuth.action(api.blockShares.actions.setBlocksShareStatus, {
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteIds: [blockNoteId],
      status: 'all_shared',
    })

    expect(receipt).toMatchObject({
      command: {
        type: 'setBlocksShareStatus',
        noteId,
        blockNoteIds: [blockNoteId],
        status: 'all_shared',
      },
      direction: 'forward',
      events: [{ type: 'updated', itemId: noteId }],
      patches: [],
      summary: { kind: 'shared', affectedCount: 1 },
      undoable: false,
    })
    expect(receipt.transactionId).toEqual(expect.any(String))
    const transaction = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('filesystemTransactions')
        .withIndex('by_operationUuid', (query) => query.eq('operationUuid', receipt.transactionId!))
        .unique()
    })
    expect(transaction).toMatchObject({
      command: receipt.command,
      events: receipt.events,
      changes: [],
      undoable: false,
    })

    const result = await getBlockShareInfo(dmAuth, {
      campaignId: ctx.campaignDomainId,
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
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteIds: [blockNoteId],
      status: 'not_shared',
    })

    const result = await getBlockShareInfo(dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteId,
    })
    expect(result).not.toBeNull()
    expect(result!.shareStatus).toBe('not_shared')
  })

  it('deduplicates block targets before recording the command', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId)
    await syncBlocksToYjs(t, noteId, [{ id: blockNoteId, type: 'paragraph' }])

    const receipt = await dmAuth.action(api.blockShares.actions.setBlocksShareStatus, {
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteIds: [blockNoteId, blockNoteId],
      status: 'all_shared',
    })

    expect(receipt.command).toMatchObject({ blockNoteIds: [blockNoteId] })
    expect(receipt.summary).toMatchObject({ affectedCount: 1 })
    expect(receipt.events).toHaveLength(1)
  })

  it('rejects commands with more than 100 unique block targets', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectValidationFailed(
      asDm(ctx).action(api.blockShares.actions.setBlocksShareStatus, {
        campaignId: ctx.campaignDomainId,
        noteId,
        blockNoteIds: Array.from({ length: 101 }, (_, index) => `block-${index + 1}`),
        status: 'all_shared',
      }),
    )
  })

  it('rejects non-UUIDv7 block targets', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectValidationFailed(
      asDm(ctx).action(api.blockShares.actions.setBlocksShareStatus, {
        campaignId: ctx.campaignDomainId,
        noteId,
        blockNoteIds: ['block-1'],
        status: 'all_shared',
      }),
    )
  })

  it('authorizes callers before projecting note content', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId, noteRowId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await t.run(async (dbCtx) => {
      await dbCtx.db.insert('yjsUpdates', {
        documentId: noteRowId,
        update: new Uint8Array([1, 2, 3]).buffer,
        seq: 0,
        isSnapshot: false,
      })
    })

    await expectPermissionDenied(
      asPlayer(ctx).action(api.blockShares.actions.setBlocksShareStatus, {
        campaignId: ctx.campaignDomainId,
        noteId,
        blockNoteIds: ['block-1'],
        status: 'all_shared',
      }),
    )
  })

  it('sets share status to individually_shared', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId)
    await syncBlocksToYjs(t, noteId, [{ id: blockNoteId, type: 'paragraph' }])

    await dmAuth.action(api.blockShares.actions.setBlocksShareStatus, {
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteIds: [blockNoteId],
      status: 'individually_shared',
    })

    const result = await getBlockShareInfo(dmAuth, {
      campaignId: ctx.campaignDomainId,
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
        campaignId: ctx.campaignDomainId,
        noteId,
        blockNoteIds: [testBlockNoteId('nonexistent-block')],
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
        campaignId: ctx.campaignDomainId,
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
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteIds: [blockNoteId],
      campaignMemberId: ctx.player.memberDomainId,
    })

    const result = await getBlockShareInfo(dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteId,
    })
    expect(result).not.toBeNull()
    expect(result!.shareStatus).toBe('individually_shared')
    expect(result!.memberPermissions[ctx.player.memberDomainId]).toBe('view')
  })

  it('shares a block with a member before they can view the note', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId)
    await syncBlocksToYjs(t, noteId, [{ id: blockNoteId, type: 'paragraph' }])

    await dmAuth.action(api.blockShares.actions.shareBlocks, {
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteIds: [blockNoteId],
      campaignMemberId: ctx.player.memberDomainId,
    })

    const dmResult = await getBlockShareInfo(dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteId,
    })
    expect(dmResult).not.toBeNull()
    expect(dmResult!.shareStatus).toBe('individually_shared')
    expect(dmResult!.memberPermissions[ctx.player.memberDomainId]).toBe('view')

    const playerNote = await playerAuth.query(api.notes.queries.getNote, {
      campaignId: ctx.campaignDomainId,
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
        campaignId: ctx.campaignDomainId,
        noteId,
        blockNoteIds: [testBlockNoteId('nonexistent-block')],
        campaignMemberId: ctx.player.memberDomainId,
      }),
    )
  })

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectPermissionDenied(
      playerAuth.action(api.blockShares.actions.shareBlocks, {
        campaignId: ctx.campaignDomainId,
        noteId,
        blockNoteIds: ['block-1'],
        campaignMemberId: ctx.player.memberDomainId,
      }),
    )
  })
})

describe('unshareBlocks', () => {
  const t = createTestContext()

  it('returns a no-op receipt when the requested block does not exist', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const receipt = await asDm(ctx).action(api.blockShares.actions.unshareBlocks, {
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteIds: [testBlockNoteId('missing-block')],
      campaignMemberId: ctx.player.memberDomainId,
    })

    expect(receipt.events).toEqual([])
    expect(receipt.summary).toMatchObject({ kind: 'noop', affectedCount: 0 })
  })

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
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteIds: [blockNoteId],
      campaignMemberId: ctx.player.memberDomainId,
    })

    await dmAuth.action(api.blockShares.actions.unshareBlocks, {
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteIds: [blockNoteId],
      campaignMemberId: ctx.player.memberDomainId,
    })

    const result = await getBlockShareInfo(dmAuth, {
      campaignId: ctx.campaignDomainId,
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
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteIds: [blockNoteId],
      campaignMemberId: ctx.player.memberDomainId,
    })

    await dmAuth.action(api.blockShares.actions.unshareBlocks, {
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteIds: [blockNoteId],
      campaignMemberId: ctx.player.memberDomainId,
    })

    const result = await getBlockShareInfo(dmAuth, {
      campaignId: ctx.campaignDomainId,
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
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteIds: [testBlockNoteId('nonexistent-block')],
      campaignMemberId: ctx.player.memberDomainId,
    })

    const result = await getBlockShareInfo(dmAuth, {
      campaignId: ctx.campaignDomainId,
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
        campaignId: ctx.campaignDomainId,
        noteId,
        blockNoteIds: ['block-1'],
        campaignMemberId: ctx.player.memberDomainId,
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
      campaignId: ctx.campaignDomainId,
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
      campaignId: ctx.campaignDomainId,
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
      campaignId: ctx.campaignDomainId,
      id: noteId,
    })) as NoteItemWithContent
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
      campaignId: ctx.campaignDomainId,
      id: noteId,
    })) as NoteItemWithContent
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
      campaignId: ctx.campaignDomainId,
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
      campaignId: ctx.campaignDomainId,
      id: noteId,
    })) as NoteItemWithContent
    expect(item).toBeTruthy()
    expect(item.blockMeta[blockNoteId]).toBeDefined()
    expect(item.blockMeta[blockNoteId].myPermissionLevel).toBe('view')
  })

  it('lets DM explicitly share a block before the player can view the note', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)
    const { noteId, noteRowId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId)
    await syncBlocksToYjs(t, noteId, [{ id: blockNoteId, type: 'paragraph' }])

    const receipt = await dmAuth.action(api.blockShares.actions.setBlockMemberPermission, {
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteIds: [blockNoteId],
      campaignMemberId: ctx.player.memberDomainId,
      permissionLevel: 'view',
    })

    expect(receipt).toMatchObject({
      command: {
        type: 'setBlockMemberPermission',
        noteId,
        blockNoteIds: [blockNoteId],
        campaignMemberId: ctx.player.memberDomainId,
        permissionLevel: 'view',
      },
      direction: 'forward',
      events: [{ type: 'updated', itemId: noteId }],
      patches: [],
      summary: { kind: 'shared', affectedCount: 1 },
      undoable: false,
    })
    expect(receipt.transactionId).toEqual(expect.any(String))

    const historyEntry = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('editHistory')
        .withIndex('by_item_action', (query) =>
          query.eq('itemId', noteRowId).eq('action', 'block_share_changed'),
        )
        .unique()
    })
    expect(historyEntry?.metadata).toMatchObject({ memberId: ctx.player.memberDomainId })

    const dmResult = await getBlockShareInfo(dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteId,
    })
    expect(dmResult).not.toBeNull()
    expect(dmResult!.memberPermissions[ctx.player.memberDomainId]).toBe('view')

    const playerResult = await playerAuth.query(api.notes.queries.getNote, {
      campaignId: ctx.campaignDomainId,
      noteId,
    })
    expect(playerResult).toBeNull()
  })

  it('rejects block share grants to a DM member', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId)
    await syncBlocksToYjs(t, noteId, [{ id: blockNoteId, type: 'paragraph' }])

    await expectValidationFailed(
      asDm(ctx).action(api.blockShares.actions.setBlockMemberPermission, {
        campaignId: ctx.campaignDomainId,
        noteId,
        blockNoteIds: [blockNoteId],
        campaignMemberId: ctx.dm.memberDomainId,
        permissionLevel: 'view',
      }),
    )
  })

  it('rejects block share grants to inactive player members', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId)
    await syncBlocksToYjs(t, noteId, [{ id: blockNoteId, type: 'paragraph' }])

    for (const status of ['Pending', 'Rejected', 'Removed'] as const) {
      await t.run(async (dbCtx) => {
        await dbCtx.db.patch('campaignMembers', ctx.player.memberId, { status })
      })
      await expectValidationFailed(
        asDm(ctx).action(api.blockShares.actions.setBlockMemberPermission, {
          campaignId: ctx.campaignDomainId,
          noteId,
          blockNoteIds: [blockNoteId],
          campaignMemberId: ctx.player.memberDomainId,
          permissionLevel: 'view',
        }),
      )
    }
  })

  it('rejects block share grants to members of another campaign', async () => {
    const ctx = await setupCampaignContext(t)
    const otherCampaign = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { blockNoteId } = await createBlock(t, noteId, ctx.campaignId)
    await syncBlocksToYjs(t, noteId, [{ id: blockNoteId, type: 'paragraph' }])

    await expectNotFound(
      asDm(ctx).action(api.blockShares.actions.setBlockMemberPermission, {
        campaignId: ctx.campaignDomainId,
        noteId,
        blockNoteIds: [blockNoteId],
        campaignMemberId: otherCampaign.player.memberDomainId,
        permissionLevel: 'view',
      }),
    )
  })

  it('does not log history for empty member permission updates', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId, noteRowId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.action(api.blockShares.actions.setBlockMemberPermission, {
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteIds: [],
      campaignMemberId: ctx.player.memberDomainId,
      permissionLevel: 'view',
    })

    const history = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('editHistory')
        .withIndex('by_item_action', (q) =>
          q.eq('itemId', noteRowId).eq('action', 'block_share_changed'),
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
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteIds: [blockNoteId],
      campaignMemberId: ctx.player.memberDomainId,
      permissionLevel: 'view',
    })

    const dmNote = (await dmAuth.query(api.notes.queries.getNote, {
      campaignId: ctx.campaignDomainId,
      noteId,
    })) as NoteItemWithContent
    expect(dmNote.blockShareAccessWarnings).toEqual([
      {
        campaignMemberId: ctx.player.memberDomainId,
        blockCount: 1,
      },
    ])

    await dmAuth.action(api.blockShares.actions.setBlocksShareStatus, {
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteIds: [blockNoteId],
      status: 'not_shared',
    })

    const dmNoteWithHiddenAllPlayers = (await dmAuth.query(api.notes.queries.getNote, {
      campaignId: ctx.campaignDomainId,
      noteId,
    })) as NoteItemWithContent
    expect(dmNoteWithHiddenAllPlayers.blockShareAccessWarnings).toEqual([
      {
        campaignMemberId: ctx.player.memberDomainId,
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
      await dbCtx.db.patch('campaignMembers', ctx.player.memberId, { status: 'Removed' })
    })

    const dmNote = (await dmAuth.query(api.notes.queries.getNote, {
      campaignId: ctx.campaignDomainId,
      noteId,
    })) as NoteItemWithContent
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
      await dbCtx.db.patch('campaignMembers', ctx.player.memberId, { status: 'Removed' })
    })

    await dmAuth.action(api.blockShares.actions.setBlockMemberPermission, {
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteIds: [blockNoteId],
      campaignMemberId: ctx.player.memberDomainId,
      permissionLevel: null,
    })

    const blockInfo = await getBlockShareInfo(dmAuth, {
      campaignId: ctx.campaignDomainId,
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
      campaignId: mCtx.campaignDomainId,
      noteId,
    })) as NoteItemWithContent
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
      campaignId: mCtx.campaignDomainId,
      id: noteId,
    })) as NoteItemWithContent
    expect(sharedResult).toBeTruthy()
    expect(sharedResult.blockMeta[blockNoteId]).toBeDefined()
    expect(sharedResult.blockMeta[blockNoteId].myPermissionLevel).toBe('view')

    const unsharedResult = (await unsharedPlayer.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: mCtx.campaignDomainId,
      id: noteId,
    })) as NoteItemWithContent
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
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteIds: [blockNoteId],
      campaignMemberId: ctx.player.memberDomainId,
      permissionLevel: 'none',
    })

    const playerResult = (await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignDomainId,
      id: noteId,
    })) as NoteItemWithContent
    expect(playerResult).toBeTruthy()
    expect(playerResult.blockMeta[blockNoteId]).toBeUndefined()

    const dmResult = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
      campaignId: ctx.campaignDomainId,
      noteId,
      blockNoteIds: [blockNoteId],
    })
    expect(dmResult.blocks[0]?.shareStatus).toBe('all_shared')
    expect(dmResult.blocks[0]?.memberPermissions[ctx.player.memberDomainId]).toBe('none')
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
      campaignId: ctx.campaignDomainId,
      id: noteId,
    })) as NoteItemWithContent
    expect(item).toBeTruthy()
    expect(item.blockMeta[blockNoteId]).toBeDefined()
    expect(item.blockMeta[blockNoteId].myPermissionLevel).toBe('view')
  })
})
