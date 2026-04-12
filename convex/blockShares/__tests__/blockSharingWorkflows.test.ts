import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupMultiPlayerContext } from '../../_test/identities.helper'
import { createBlock, createNote, createSidebarShare } from '../../_test/factories.helper'
import { api } from '../../_generated/api'

describe('block sharing workflows', () => {
  const t = createTestContext()

  describe('granular block sharing', () => {
    it('controls per-player block visibility through share status transitions', async () => {
      const ctx = await setupMultiPlayerContext(t, 2)
      const dmAuth = asDm(ctx)
      const p1 = ctx.players[0]
      const p2 = ctx.players[1]

      const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
      const block1 = await createBlock(t, note.noteId, ctx.campaignId, ctx.dm.profile._id)
      const block2 = await createBlock(t, note.noteId, ctx.campaignId, ctx.dm.profile._id)

      await createSidebarShare(t, ctx.dm.profile._id, {
        campaignId: ctx.campaignId,
        sidebarItemId: note.noteId,
        sidebarItemType: 'note',
        campaignMemberId: p1.memberId,
      })
      await createSidebarShare(t, ctx.dm.profile._id, {
        campaignId: ctx.campaignId,
        sidebarItemId: note.noteId,
        sidebarItemType: 'note',
        campaignMemberId: p2.memberId,
      })

      await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blocks: [{ blockNoteId: block1.blockId }, { blockNoteId: block2.blockId }],
        status: 'individually_shared',
      })

      await dmAuth.mutation(api.blockShares.mutations.shareBlocks, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blocks: [{ blockNoteId: block1.blockId }],
        campaignMemberId: p1.memberId,
      })

      const dmResult = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockIds: [block1.blockId, block2.blockId],
      })

      const b1Info = dmResult.blocks.find((b) => b.blockNoteId === block1.blockId)!
      expect(b1Info.shareStatus).toBe('individually_shared')
      expect(b1Info.sharedMemberIds).toContain(p1.memberId)
      expect(b1Info.sharedMemberIds).not.toContain(p2.memberId)

      const b2Info = dmResult.blocks.find((b) => b.blockNoteId === block2.blockId)!
      expect(b2Info.shareStatus).toBe('individually_shared')
      expect(b2Info.sharedMemberIds).toHaveLength(0)

      await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blocks: [{ blockNoteId: block1.blockId }, { blockNoteId: block2.blockId }],
        status: 'all_shared',
      })

      const allSharedResult = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockIds: [block1.blockId, block2.blockId],
      })
      for (const b of allSharedResult.blocks) {
        expect(b.shareStatus).toBe('all_shared')
      }

      await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blocks: [{ blockNoteId: block1.blockId }, { blockNoteId: block2.blockId }],
        status: 'not_shared',
      })

      const notSharedResult = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockIds: [block1.blockId, block2.blockId],
      })
      for (const b of notSharedResult.blocks) {
        expect(b.shareStatus).toBe('not_shared')
        expect(b.sharedMemberIds).toHaveLength(0)
      }
    })
  })

  describe('block cleanup on unshare', () => {
    it('soft-deletes block shares and resets status when last share is removed', async () => {
      const ctx = await setupMultiPlayerContext(t, 1)
      const dmAuth = asDm(ctx)
      const p1 = ctx.players[0]

      const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
      const block = await createBlock(t, note.noteId, ctx.campaignId, ctx.dm.profile._id)

      await createSidebarShare(t, ctx.dm.profile._id, {
        campaignId: ctx.campaignId,
        sidebarItemId: note.noteId,
        sidebarItemType: 'note',
        campaignMemberId: p1.memberId,
      })

      await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blocks: [{ blockNoteId: block.blockId }],
        status: 'individually_shared',
      })

      await dmAuth.mutation(api.blockShares.mutations.shareBlocks, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blocks: [{ blockNoteId: block.blockId }],
        campaignMemberId: p1.memberId,
      })

      const beforeUnshare = await t.run(async (dbCtx) => {
        return dbCtx.db
          .query('blockShares')
          .withIndex('by_campaign_block_member', (q) =>
            q
              .eq('campaignId', ctx.campaignId)
              .eq('blockId', block.blockDbId)
              .eq('campaignMemberId', p1.memberId),
          )
          .unique()
      })
      expect(beforeUnshare).not.toBeNull()
      expect(beforeUnshare!.deletionTime).toBeNull()

      await dmAuth.mutation(api.blockShares.mutations.unshareBlocks, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blocks: [{ blockNoteId: block.blockId }],
        campaignMemberId: p1.memberId,
      })

      const afterUnshare = await t.run(async (dbCtx) => {
        return dbCtx.db
          .query('blockShares')
          .withIndex('by_campaign_block_member', (q) =>
            q
              .eq('campaignId', ctx.campaignId)
              .eq('blockId', block.blockDbId)
              .eq('campaignMemberId', p1.memberId),
          )
          .unique()
      })
      expect(afterUnshare).not.toBeNull()
      expect(afterUnshare!.deletionTime).not.toBeNull()

      const blockAfter = await t.run(async (dbCtx) => dbCtx.db.get('blocks', block.blockDbId))
      expect(blockAfter!.shareStatus).toBe('not_shared')
    })
  })

  describe('unshare on never-shared block', () => {
    it('is a no-op when the block was never shared', async () => {
      const ctx = await setupMultiPlayerContext(t, 1)
      const dmAuth = asDm(ctx)
      const p1 = ctx.players[0]

      const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
      const block = await createBlock(t, note.noteId, ctx.campaignId, ctx.dm.profile._id)

      await createSidebarShare(t, ctx.dm.profile._id, {
        campaignId: ctx.campaignId,
        sidebarItemId: note.noteId,
        sidebarItemType: 'note',
        campaignMemberId: p1.memberId,
      })

      await dmAuth.mutation(api.blockShares.mutations.unshareBlocks, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blocks: [{ blockNoteId: block.blockId }],
        campaignMemberId: p1.memberId,
      })

      const shareRow = await t.run(async (dbCtx) => {
        return dbCtx.db
          .query('blockShares')
          .withIndex('by_campaign_block_member', (q) =>
            q
              .eq('campaignId', ctx.campaignId)
              .eq('blockId', block.blockDbId)
              .eq('campaignMemberId', p1.memberId),
          )
          .unique()
      })
      expect(shareRow).toBeNull()

      const blockAfter = await t.run(async (dbCtx) => dbCtx.db.get('blocks', block.blockDbId))
      expect(blockAfter!.shareStatus).toBe('not_shared')
    })
  })

  describe('idempotent share', () => {
    it('does not create a duplicate when shareBlocks is called twice for the same member', async () => {
      const ctx = await setupMultiPlayerContext(t, 1)
      const dmAuth = asDm(ctx)
      const p1 = ctx.players[0]

      const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
      const block = await createBlock(t, note.noteId, ctx.campaignId, ctx.dm.profile._id)

      await createSidebarShare(t, ctx.dm.profile._id, {
        campaignId: ctx.campaignId,
        sidebarItemId: note.noteId,
        sidebarItemType: 'note',
        campaignMemberId: p1.memberId,
      })

      await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blocks: [{ blockNoteId: block.blockId }],
        status: 'individually_shared',
      })

      await dmAuth.mutation(api.blockShares.mutations.shareBlocks, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blocks: [{ blockNoteId: block.blockId }],
        campaignMemberId: p1.memberId,
      })

      await dmAuth.mutation(api.blockShares.mutations.shareBlocks, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blocks: [{ blockNoteId: block.blockId }],
        campaignMemberId: p1.memberId,
      })

      const allShares = await t.run(async (dbCtx) => {
        return dbCtx.db
          .query('blockShares')
          .withIndex('by_campaign_block_member', (q) =>
            q
              .eq('campaignId', ctx.campaignId)
              .eq('blockId', block.blockDbId)
              .eq('campaignMemberId', p1.memberId),
          )
          .collect()
      })
      const activeShares = allShares.filter((s) => s.deletionTime === null)
      expect(activeShares).toHaveLength(1)

      const result = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockIds: [block.blockId],
      })
      const blockInfo = result.blocks.find((b) => b.blockNoteId === block.blockId)!
      expect(blockInfo.sharedMemberIds.filter((id) => id === p1.memberId)).toHaveLength(1)
    })
  })

  describe('share without sidebar share', () => {
    it('creates a block share even when the member has no sidebar share', async () => {
      const ctx = await setupMultiPlayerContext(t, 1)
      const dmAuth = asDm(ctx)
      const p1 = ctx.players[0]

      const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
      const block = await createBlock(t, note.noteId, ctx.campaignId, ctx.dm.profile._id)

      await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blocks: [{ blockNoteId: block.blockId }],
        status: 'individually_shared',
      })

      await dmAuth.mutation(api.blockShares.mutations.shareBlocks, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blocks: [{ blockNoteId: block.blockId }],
        campaignMemberId: p1.memberId,
      })

      const result = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockIds: [block.blockId],
      })
      const blockInfo = result.blocks.find((b) => b.blockNoteId === block.blockId)!
      expect(blockInfo.sharedMemberIds).toContain(p1.memberId)
    })
  })
})
