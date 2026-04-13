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

describe('share mutations with nested blocks', () => {
  const t = createTestContext()

  it('shares a nested block at depth > 0', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockId: testBlockNoteId('root'),
      depth: 0,
      parentBlockId: null,
    })
    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockId: testBlockNoteId('child'),
      depth: 1,
      parentBlockId: testBlockNoteId('root'),
    })

    await dmAuth.mutation(api.blockShares.mutations.shareBlocks, {
      campaignId: ctx.campaignId,
      noteId,
      blocks: [{ blockNoteId: testBlockNoteId('child') }],
      campaignMemberId: ctx.player.memberId,
    })

    const result = await dmAuth.query(api.blocks.queries.getBlockWithShares, {
      campaignId: ctx.campaignId,
      noteId,
      blockId: testBlockNoteId('child'),
    })
    expect(result).not.toBeNull()
    expect(result!.shareStatus).toBe('individually_shared')
    expect(result!.shares).toHaveLength(1)
    expect(result!.shares[0].campaignMemberId).toBe(ctx.player.memberId)
  })

  it('sets share status on blocks at multiple depths', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockId: testBlockNoteId('depth-0'),
      depth: 0,
      parentBlockId: null,
    })
    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockId: testBlockNoteId('depth-1'),
      depth: 1,
      parentBlockId: testBlockNoteId('depth-0'),
    })
    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockId: testBlockNoteId('depth-2'),
      depth: 2,
      parentBlockId: testBlockNoteId('depth-1'),
    })

    await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
      campaignId: ctx.campaignId,
      noteId,
      blocks: [
        { blockNoteId: testBlockNoteId('depth-0') },
        { blockNoteId: testBlockNoteId('depth-1') },
        { blockNoteId: testBlockNoteId('depth-2') },
      ],
      status: 'all_shared',
    })

    const result = await dmAuth.query(api.blocks.queries.getBlocksWithShares, {
      campaignId: ctx.campaignId,
      noteId,
      blockIds: [
        testBlockNoteId('depth-0'),
        testBlockNoteId('depth-1'),
        testBlockNoteId('depth-2'),
      ],
    })

    expect(result.blocks).toHaveLength(3)
    for (const block of result.blocks) {
      expect(block.shareStatus).toBe('all_shared')
    }
  })

  it('setting not_shared clears shares on a nested block', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockId: testBlockNoteId('some-parent'),
      depth: 0,
      parentBlockId: null,
    })
    const { blockDbId } = await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockId: testBlockNoteId('nested'),
      depth: 1,
      parentBlockId: testBlockNoteId('some-parent'),
      shareStatus: 'individually_shared',
    })

    await createBlockShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      noteId,
      blockId: blockDbId,
      campaignMemberId: ctx.player.memberId,
    })

    await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
      campaignId: ctx.campaignId,
      noteId,
      blocks: [{ blockNoteId: testBlockNoteId('nested') }],
      status: 'not_shared',
    })

    const result = await dmAuth.query(api.blocks.queries.getBlockWithShares, {
      campaignId: ctx.campaignId,
      noteId,
      blockId: testBlockNoteId('nested'),
    })
    expect(result!.shareStatus).toBe('not_shared')

    await t.run(async (dbCtx) => {
      const shares = await dbCtx.db
        .query('blockShares')
        .filter((q) => q.eq(q.field('blockId'), blockDbId))
        .collect()
      const active = shares.filter((s) => s.deletionTime === null)
      expect(active).toHaveLength(0)
    })
  })

  it('persist removes block and its shares together', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Cascade Test',
      parentId: null,
    })

    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockId: testBlockNoteId('root'),
      depth: 0,
      parentBlockId: null,
    })
    const { blockDbId: childDbId } = await createBlock(
      t,
      noteId,
      ctx.campaignId,
      ctx.dm.profile._id,
      {
        blockId: testBlockNoteId('child'),
        depth: 1,
        parentBlockId: testBlockNoteId('root'),
        shareStatus: 'individually_shared',
      },
    )

    const shareId = await t.run(async (dbCtx) => {
      return await dbCtx.db.insert('blockShares', {
        campaignId: ctx.campaignId,
        noteId,
        blockId: childDbId,
        campaignMemberId: ctx.player.memberId,
        sessionId: null,
        deletionTime: null,
        deletedBy: null,
        updatedTime: null,
        updatedBy: null,
        createdBy: ctx.dm.profile._id,
      })
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignId,
      documentId: noteId,
      update: makeYjsUpdateWithBlocks([
        { id: testBlockNoteId('root'), type: 'paragraph', props: {}, children: [] },
      ]),
    })
    await dmAuth.mutation(api.notes.mutations.persistNoteBlocks, {
      campaignId: ctx.campaignId,
      documentId: noteId,
    })

    await t.run(async (dbCtx) => {
      const child = await dbCtx.db.get('blocks', childDbId)
      expect(child).toBeNull()
      const share = await dbCtx.db.get('blockShares', shareId)
      expect(share).toBeNull()
    })
  })
})
