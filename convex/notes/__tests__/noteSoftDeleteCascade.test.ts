import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { createNoteViaFilesystem } from '../../_test/filesystemSetup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import {
  executeMoveCommand,
  createBlock,
  createBlockShare,
  createNote,
  testBlockNoteId,
} from '../../_test/factories.helper'
import { api } from '../../_generated/api'
import { makeYjsUpdateWithBlocks } from '../../_test/yjs.helper'

describe('note soft-delete does NOT cascade to blocks and blockShares', () => {
  const t = createTestContext()

  it('soft-deleting a note does not touch blocks', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('root'),
      depth: 0,
      parentBlockId: null,
    })
    await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('child'),
      depth: 1,
      parentBlockId: testBlockNoteId('root'),
    })

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'trash',
    })

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteId))
        .collect()

      expect(blocks).toHaveLength(2)
      for (const block of blocks) {
        expect(block).not.toHaveProperty('deletionTime')
      }
    })
  })

  it('soft-deleting a note does not touch blockShares', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const { blockDbId } = await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('shared'),
      shareStatus: 'individually_shared',
    })
    await createBlockShare(t, {
      campaignId: ctx.campaignId,
      noteId,
      blockId: blockDbId,
      campaignMemberId: ctx.player.memberId,
    })

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'trash',
    })

    await t.run(async (dbCtx) => {
      const shares = await dbCtx.db
        .query('blockShares')
        .filter((q) => q.eq(q.field('noteId'), noteId))
        .collect()

      expect(shares).toHaveLength(1)
      expect(shares[0]).not.toHaveProperty('deletionTime')
    })
  })

  it('restoring a note does not need to touch blocks or blockShares', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('root'),
      depth: 0,
      parentBlockId: null,
    })
    const { blockDbId } = await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('shared'),
      shareStatus: 'individually_shared',
    })
    await createBlockShare(t, {
      campaignId: ctx.campaignId,
      noteId,
      blockId: blockDbId,
      campaignMemberId: ctx.player.memberId,
    })

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'trash',
    })

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'restore',
    })

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteId))
        .collect()
      expect(blocks).toHaveLength(2)
      for (const block of blocks) {
        expect(block).not.toHaveProperty('deletionTime')
      }

      const shares = await dbCtx.db
        .query('blockShares')
        .filter((q) => q.eq(q.field('noteId'), noteId))
        .collect()
      expect(shares).toHaveLength(1)
      expect(shares[0]).not.toHaveProperty('deletionTime')
    })
  })

  it('rejects Yjs writes when note is soft-deleted', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Persist Guard',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      update: makeYjsUpdateWithBlocks([
        { id: testBlockNoteId('block-a'), type: 'paragraph', props: {}, children: [] },
      ]),
    })
    await dmAuth.action(api.notes.actions.persistNoteBlocks, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
    })

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'trash',
    })

    await expect(
      dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        update: makeYjsUpdateWithBlocks([
          { id: testBlockNoteId('block-b'), type: 'heading', props: { level: 1 }, children: [] },
        ]),
      }),
    ).rejects.toThrow('Document is not active')

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteId))
        .collect()

      const blockB = blocks.find((b) => b.blockNoteId === testBlockNoteId('block-b'))
      expect(blockB).toBeUndefined()
    })
  })
})
