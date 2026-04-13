import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import {
  createBlock,
  createBlockShare,
  createNote,
  testBlockNoteId,
} from '../../_test/factories.helper'
import { api } from '../../_generated/api'
import { makeYjsUpdateWithBlocks } from '../../yjsSync/__tests__/makeYjsUpdate.helper'

describe('note soft-delete cascade to blocks and blockShares', () => {
  const t = createTestContext()

  it('soft-deleting a note cascades deletionTime to all blocks including nested', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockNoteId: testBlockNoteId('root'),
      depth: 0,
      parentBlockId: null,
    })
    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockNoteId: testBlockNoteId('child'),
      depth: 1,
      parentBlockId: testBlockNoteId('root'),
    })

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: noteId,
      location: 'trash',
    })

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteId))
        .collect()

      expect(blocks).toHaveLength(2)
      for (const block of blocks) {
        expect(block.deletionTime).toBeTypeOf('number')
      }
    })
  })

  it('soft-deleting a note cascades deletionTime to blockShares', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const { blockDbId } = await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockNoteId: testBlockNoteId('shared'),
      shareStatus: 'individually_shared',
    })
    await createBlockShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      noteId,
      blockId: blockDbId,
      campaignMemberId: ctx.player.memberId,
    })

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: noteId,
      location: 'trash',
    })

    await t.run(async (dbCtx) => {
      const shares = await dbCtx.db
        .query('blockShares')
        .filter((q) => q.eq(q.field('noteId'), noteId))
        .collect()

      expect(shares).toHaveLength(1)
      expect(shares[0].deletionTime).toBeTypeOf('number')
    })
  })

  it('restoring a note restores all blocks and blockShares', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockNoteId: testBlockNoteId('root'),
      depth: 0,
      parentBlockId: null,
    })
    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockNoteId: testBlockNoteId('child'),
      depth: 1,
      parentBlockId: testBlockNoteId('root'),
    })
    const { blockDbId } = await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockNoteId: testBlockNoteId('shared'),
      shareStatus: 'individually_shared',
    })
    await createBlockShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      noteId,
      blockId: blockDbId,
      campaignMemberId: ctx.player.memberId,
    })

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: noteId,
      location: 'trash',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: noteId,
      location: 'sidebar',
    })

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteId))
        .collect()
      expect(blocks).toHaveLength(3)
      for (const block of blocks) {
        expect(block.deletionTime).toBeNull()
      }

      const shares = await dbCtx.db
        .query('blockShares')
        .filter((q) => q.eq(q.field('noteId'), noteId))
        .collect()
      expect(shares).toHaveLength(1)
      expect(shares[0].deletionTime).toBeNull()
    })
  })

  it('persist is a no-op when note is soft-deleted', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Persist Guard',
      parentId: null,
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignId,
      documentId: noteId,
      update: makeYjsUpdateWithBlocks([
        { id: testBlockNoteId('block-a'), type: 'paragraph', props: {}, children: [] },
      ]),
    })
    await dmAuth.mutation(api.notes.mutations.persistNoteBlocks, {
      campaignId: ctx.campaignId,
      documentId: noteId,
    })

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: noteId,
      location: 'trash',
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignId,
      documentId: noteId,
      update: makeYjsUpdateWithBlocks([
        { id: testBlockNoteId('block-b'), type: 'heading', props: { level: 1 }, children: [] },
      ]),
    })
    await dmAuth.mutation(api.notes.mutations.persistNoteBlocks, {
      campaignId: ctx.campaignId,
      documentId: noteId,
    })

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteId))
        .collect()

      const nonDeleted = blocks.filter((b) => b.deletionTime == null)
      expect(nonDeleted).toHaveLength(0)

      const blockB = blocks.find((b) => b.blockNoteId === testBlockNoteId('block-b'))
      expect(blockB).toBeUndefined()
    })
  })
})
