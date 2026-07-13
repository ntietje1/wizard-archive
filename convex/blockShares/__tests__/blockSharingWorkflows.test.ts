import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupMultiPlayerContext } from '../../_test/identities.helper'
import {
  createBlock,
  createFolder,
  createNote,
  createSidebarShare,
  syncBlocksToYjs,
  testBlockNoteId,
} from '../../_test/factories.helper'
import { expectPermissionDenied } from '../../_test/assertions.helper'
import { getBlockShareInfo } from '../../_test/blockShareQueries.helper'
import { api } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import type { NoteBlockId } from '@wizard-archive/editor/resources/domain-id'

async function getBlockDbId(
  t: ReturnType<typeof createTestContext>,
  {
    campaignId,
    noteId,
    blockNoteId,
  }: { campaignId: Id<'campaigns'>; noteId: Id<'sidebarItems'>; blockNoteId: NoteBlockId },
) {
  const block = await t.run(async (dbCtx) => {
    return await dbCtx.db
      .query('blocks')
      .withIndex('by_campaign_note_block', (q) =>
        q.eq('campaignId', campaignId).eq('noteId', noteId).eq('blockNoteId', blockNoteId),
      )
      .unique()
  })
  expect(block).not.toBeNull()
  return block!._id
}

describe('block sharing workflows', () => {
  const t = createTestContext()

  describe('granular block sharing', () => {
    it('does not project pending Yjs blocks for non-DM share attempts', async () => {
      const ctx = await setupMultiPlayerContext(t, 1)
      const player = ctx.players[0]
      const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

      await createSidebarShare(t, {
        campaignId: ctx.campaignId,
        sidebarItemId: note.noteId,
        sidebarItemType: 'note',
        campaignMemberId: player.memberId,
        permissionLevel: 'edit',
      })
      await syncBlocksToYjs(t, note.noteId, [
        {
          id: testBlockNoteId('pending-block'),
          type: 'paragraph',
          content: [{ type: 'text', text: 'Draft' }],
        },
      ])

      await expectPermissionDenied(
        player.authed.action(api.blockShares.actions.setBlocksShareStatus, {
          campaignId: ctx.campaignId,
          noteId: note.noteId,
          blockNoteIds: ['pending-block'],
          status: 'all_shared',
        }),
      )

      const projectedBlock = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('blocks')
          .withIndex('by_campaign_note_block', (q) =>
            q
              .eq('campaignId', ctx.campaignId)
              .eq('noteId', note.noteId)
              .eq('blockNoteId', testBlockNoteId('pending-block')),
          )
          .unique()
      })
      expect(projectedBlock).toBeNull()
    })

    it('controls per-player block visibility through share status transitions', async () => {
      const ctx = await setupMultiPlayerContext(t, 2)
      const dmAuth = asDm(ctx)
      const p1 = ctx.players[0]
      const p2 = ctx.players[1]

      const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
      const block1 = await createBlock(t, note.noteId, ctx.campaignId)
      const block2 = await createBlock(t, note.noteId, ctx.campaignId)
      await syncBlocksToYjs(t, note.noteId, [
        { id: block1.blockNoteId, type: 'paragraph' },
        { id: block2.blockNoteId, type: 'paragraph' },
      ])

      await createSidebarShare(t, {
        campaignId: ctx.campaignId,
        sidebarItemId: note.noteId,
        sidebarItemType: 'note',
        campaignMemberId: p1.memberId,
      })
      await createSidebarShare(t, {
        campaignId: ctx.campaignId,
        sidebarItemId: note.noteId,
        sidebarItemType: 'note',
        campaignMemberId: p2.memberId,
      })

      await dmAuth.action(api.blockShares.actions.setBlocksShareStatus, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteIds: [block1.blockNoteId, block2.blockNoteId],
        status: 'individually_shared',
      })

      await dmAuth.action(api.blockShares.actions.shareBlocks, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteIds: [block1.blockNoteId],
        campaignMemberId: p1.memberId,
      })

      const dmResult = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteIds: [block1.blockNoteId, block2.blockNoteId],
      })

      const b1Info = dmResult.blocks.find((b) => b.noteBlockId === block1.blockNoteId)
      expect(b1Info).toBeDefined()
      expect(b1Info!.shareStatus).toBe('individually_shared')
      expect(b1Info!.memberPermissions).toEqual({
        [p1.memberId]: 'view',
      })

      const b2Info = dmResult.blocks.find((b) => b.noteBlockId === block2.blockNoteId)
      expect(b2Info).toBeDefined()
      expect(b2Info!.shareStatus).toBe('individually_shared')
      expect(b2Info!.memberPermissions).toEqual({})

      await dmAuth.action(api.blockShares.actions.setBlocksShareStatus, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteIds: [block1.blockNoteId, block2.blockNoteId],
        status: 'all_shared',
      })

      const allSharedResult = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteIds: [block1.blockNoteId, block2.blockNoteId],
      })
      for (const b of allSharedResult.blocks) {
        expect(b.shareStatus).toBe('all_shared')
      }

      await dmAuth.action(api.blockShares.actions.setBlocksShareStatus, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteIds: [block1.blockNoteId, block2.blockNoteId],
        status: 'not_shared',
      })

      const notSharedResult = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteIds: [block1.blockNoteId, block2.blockNoteId],
      })
      for (const b of notSharedResult.blocks) {
        expect(b.shareStatus).toBe('not_shared')
        expect(b.memberPermissions).toEqual(
          b.noteBlockId === block1.blockNoteId ? { [p1.memberId]: 'view' } : {},
        )
      }
    })
  })

  describe('block cleanup on unshare', () => {
    it('hard-deletes block shares and resets status when last share is removed', async () => {
      const ctx = await setupMultiPlayerContext(t, 1)
      const dmAuth = asDm(ctx)
      const p1 = ctx.players[0]

      const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
      const block = await createBlock(t, note.noteId, ctx.campaignId)
      await syncBlocksToYjs(t, note.noteId, [{ id: block.blockNoteId, type: 'paragraph' }])

      await createSidebarShare(t, {
        campaignId: ctx.campaignId,
        sidebarItemId: note.noteId,
        sidebarItemType: 'note',
        campaignMemberId: p1.memberId,
      })

      await dmAuth.action(api.blockShares.actions.setBlocksShareStatus, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteIds: [block.blockNoteId],
        status: 'individually_shared',
      })

      await dmAuth.action(api.blockShares.actions.shareBlocks, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteIds: [block.blockNoteId],
        campaignMemberId: p1.memberId,
      })

      const blockDbId = await getBlockDbId(t, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteId: block.blockNoteId,
      })

      const beforeUnshare = await t.run(async (dbCtx) => {
        return dbCtx.db
          .query('blockShares')
          .withIndex('by_campaign_block_member', (q) =>
            q
              .eq('campaignId', ctx.campaignId)
              .eq('blockId', blockDbId)
              .eq('campaignMemberId', p1.memberId),
          )
          .unique()
      })
      expect(beforeUnshare).not.toBeNull()

      await dmAuth.action(api.blockShares.actions.unshareBlocks, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteIds: [block.blockNoteId],
        campaignMemberId: p1.memberId,
      })

      const afterUnshare = await t.run(async (dbCtx) => {
        return dbCtx.db
          .query('blockShares')
          .withIndex('by_campaign_block_member', (q) =>
            q
              .eq('campaignId', ctx.campaignId)
              .eq('blockId', blockDbId)
              .eq('campaignMemberId', p1.memberId),
          )
          .unique()
      })
      expect(afterUnshare).toBeNull()

      const blockAfter = await getBlockShareInfo(dmAuth, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteId: block.blockNoteId,
      })
      expect(blockAfter).not.toBeNull()
      expect(blockAfter!.shareStatus).toBe('not_shared')
    })
  })

  describe('unshare on never-shared block', () => {
    it('is a no-op when the block was never shared', async () => {
      const ctx = await setupMultiPlayerContext(t, 1)
      const dmAuth = asDm(ctx)
      const p1 = ctx.players[0]

      const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
      const block = await createBlock(t, note.noteId, ctx.campaignId)
      await syncBlocksToYjs(t, note.noteId, [{ id: block.blockNoteId, type: 'paragraph' }])

      await createSidebarShare(t, {
        campaignId: ctx.campaignId,
        sidebarItemId: note.noteId,
        sidebarItemType: 'note',
        campaignMemberId: p1.memberId,
      })

      await dmAuth.action(api.blockShares.actions.unshareBlocks, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteIds: [block.blockNoteId],
        campaignMemberId: p1.memberId,
      })

      const blockAfter = await getBlockShareInfo(dmAuth, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteId: block.blockNoteId,
      })
      expect(blockAfter).not.toBeNull()
      expect(blockAfter!.memberPermissions).toEqual({})
      expect(blockAfter!.shareStatus).toBe('not_shared')
    })
  })

  describe('idempotent share', () => {
    it('does not create a duplicate when shareBlocks is called twice for the same member', async () => {
      const ctx = await setupMultiPlayerContext(t, 1)
      const dmAuth = asDm(ctx)
      const p1 = ctx.players[0]

      const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
      const block = await createBlock(t, note.noteId, ctx.campaignId)
      await syncBlocksToYjs(t, note.noteId, [{ id: block.blockNoteId, type: 'paragraph' }])

      await createSidebarShare(t, {
        campaignId: ctx.campaignId,
        sidebarItemId: note.noteId,
        sidebarItemType: 'note',
        campaignMemberId: p1.memberId,
      })

      await dmAuth.action(api.blockShares.actions.setBlocksShareStatus, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteIds: [block.blockNoteId],
        status: 'individually_shared',
      })

      await dmAuth.action(api.blockShares.actions.shareBlocks, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteIds: [block.blockNoteId],
        campaignMemberId: p1.memberId,
      })

      await dmAuth.action(api.blockShares.actions.shareBlocks, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteIds: [block.blockNoteId],
        campaignMemberId: p1.memberId,
      })

      const blockDbId = await getBlockDbId(t, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteId: block.blockNoteId,
      })

      const allShares = await t.run(async (dbCtx) => {
        return dbCtx.db
          .query('blockShares')
          .withIndex('by_campaign_block_member', (q) =>
            q
              .eq('campaignId', ctx.campaignId)
              .eq('blockId', blockDbId)
              .eq('campaignMemberId', p1.memberId),
          )
          .collect()
      })
      expect(allShares).toHaveLength(1)

      const result = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteIds: [block.blockNoteId],
      })
      const blockInfo = result.blocks.find((b) => b.noteBlockId === block.blockNoteId)
      expect(blockInfo).toBeDefined()
      expect(blockInfo!.memberPermissions[p1.memberId]).toBe('view')
    })
  })

  describe('share without sidebar share', () => {
    it('records an explicit block share when the member cannot view the note', async () => {
      const ctx = await setupMultiPlayerContext(t, 1)
      const dmAuth = asDm(ctx)
      const p1 = ctx.players[0]

      const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
      const block = await createBlock(t, note.noteId, ctx.campaignId)
      await syncBlocksToYjs(t, note.noteId, [{ id: block.blockNoteId, type: 'paragraph' }])

      await dmAuth.action(api.blockShares.actions.setBlocksShareStatus, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteIds: [block.blockNoteId],
        status: 'individually_shared',
      })

      await dmAuth.action(api.blockShares.actions.shareBlocks, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteIds: [block.blockNoteId],
        campaignMemberId: p1.memberId,
      })

      const result = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteIds: [block.blockNoteId],
      })
      const blockInfo = result.blocks.find((b) => b.noteBlockId === block.blockNoteId)
      expect(blockInfo).toBeDefined()
      expect(result.playerMembers.map((m) => m.id)).toContain(p1.memberId)
      expect(result.notePermissionsByMemberId[p1.memberId]).toBe('none')
      expect(blockInfo!.memberPermissions[p1.memberId]).toBe('view')
    })

    it('records explicit block shares even when note all-player permission is none', async () => {
      const ctx = await setupMultiPlayerContext(t, 1)
      const dmAuth = asDm(ctx)
      const p1 = ctx.players[0]

      const folder = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
        allPermissionLevel: 'view',
      })
      const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        parentId: folder.folderId,
        allPermissionLevel: 'none',
      })
      const block = await createBlock(t, note.noteId, ctx.campaignId)
      await syncBlocksToYjs(t, note.noteId, [{ id: block.blockNoteId, type: 'paragraph' }])

      await dmAuth.action(api.blockShares.actions.setBlocksShareStatus, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteIds: [block.blockNoteId],
        status: 'individually_shared',
      })

      await dmAuth.action(api.blockShares.actions.shareBlocks, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteIds: [block.blockNoteId],
        campaignMemberId: p1.memberId,
      })

      const blockInfo = await getBlockShareInfo(dmAuth, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockNoteId: block.blockNoteId,
      })
      expect(blockInfo?.memberPermissions[p1.memberId]).toBe('view')
    })
  })
})
