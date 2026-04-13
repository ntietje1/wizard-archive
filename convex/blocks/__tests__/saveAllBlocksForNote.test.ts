import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createBlock, testBlockNoteId } from '../../_test/factories.helper'
import { api } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import {
  makeYjsUpdate,
  makeYjsUpdateWithBlocks,
} from '../../yjsSync/__tests__/makeYjsUpdate.helper'

async function pushAndPersist(
  dmAuth: ReturnType<typeof asDm>,
  campaignId: Id<'campaigns'>,
  noteId: Id<'sidebarItems'>,
  blocks: Parameters<typeof makeYjsUpdateWithBlocks>[0],
) {
  await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
    campaignId,
    documentId: noteId,
    update: makeYjsUpdateWithBlocks(blocks),
  })
  await dmAuth.mutation(api.notes.mutations.persistNoteBlocks, {
    campaignId,
    documentId: noteId,
  })
}

describe('saveAllBlocksForNote — upsert and delete behavior', () => {
  const t = createTestContext()

  it('updates existing blocks in place rather than reinserting', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Update Test',
      parentId: null,
    })

    await pushAndPersist(dmAuth, ctx.campaignId, noteId, [
      {
        id: testBlockNoteId('block-a'),
        type: 'heading',
        props: { level: 1 },
        content: [{ type: 'text', text: 'Hello', styles: {} }],
        children: [],
      },
    ])

    const originalBlock = await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteId))
        .collect()
      return blocks.find((b) => b.blockNoteId === testBlockNoteId('block-a'))!
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
      expect(blocks).toHaveLength(1)
      const block = blocks[0]
      expect(block._id).toBe(originalBlock._id)
      expect(block.updatedTime).not.toBe(originalBlock.updatedTime)
    })
  })

  it('hard-deletes blocks removed from document', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Delete Test',
      parentId: null,
    })

    const { blockDbId: removedBlockId } = await createBlock(
      t,
      noteId,
      ctx.campaignId,
      ctx.dm.profile._id,
      {
        blockNoteId: testBlockNoteId('remove'),
      },
    )

    await pushAndPersist(dmAuth, ctx.campaignId, noteId, [
      { id: testBlockNoteId('keep'), type: 'paragraph', props: {}, children: [] },
    ])

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteId))
        .collect()
      expect(blocks).toHaveLength(1)
      expect(blocks[0].blockNoteId).toBe(testBlockNoteId('keep'))
      const removed = await dbCtx.db.get('blocks', removedBlockId)
      expect(removed).toBeNull()
    })
  })

  it('hard-deletes blockShares when their block is removed', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Share Cascade Test',
      parentId: null,
    })

    const { blockDbId } = await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockNoteId: testBlockNoteId('shared-block'),
      shareStatus: 'individually_shared',
    })

    const shareId = await t.run(async (dbCtx) => {
      return await dbCtx.db.insert('blockShares', {
        campaignId: ctx.campaignId,
        noteId,
        blockId: blockDbId,
        campaignMemberId: ctx.player.memberId,
        sessionId: null,
        deletionTime: null,
        deletedBy: null,
        updatedTime: null,
        updatedBy: null,
        createdBy: ctx.dm.profile._id,
      })
    })

    await pushAndPersist(dmAuth, ctx.campaignId, noteId, [
      { id: testBlockNoteId('other-block'), type: 'paragraph', props: {}, children: [] },
    ])

    await t.run(async (dbCtx) => {
      const block = await dbCtx.db.get('blocks', blockDbId)
      expect(block).toBeNull()
      const share = await dbCtx.db.get('blockShares', shareId)
      expect(share).toBeNull()
    })
  })

  it('preserves shareStatus on existing blocks during persist', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Preserve Share Test',
      parentId: null,
    })

    await pushAndPersist(dmAuth, ctx.campaignId, noteId, [
      {
        id: testBlockNoteId('block-a'),
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: 'Hello', styles: {} }],
        children: [],
      },
    ])

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteId))
        .collect()
      await dbCtx.db.patch('blocks', blocks[0]._id, { shareStatus: 'all_shared' })
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
      expect(blocks).toHaveLength(1)
      expect(blocks[0].shareStatus).toBe('all_shared')
    })
  })

  it('does not insert or delete blocks when note is soft-deleted', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Soft Delete Guard',
      parentId: null,
    })

    await pushAndPersist(dmAuth, ctx.campaignId, noteId, [
      { id: testBlockNoteId('block-a'), type: 'paragraph', props: {}, children: [] },
    ])

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: noteId,
      location: 'trash',
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignId,
      documentId: noteId,
      update: makeYjsUpdateWithBlocks([
        { id: testBlockNoteId('block-a'), type: 'paragraph', props: {}, children: [] },
        { id: testBlockNoteId('block-b'), type: 'paragraph', props: {}, children: [] },
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
      const nonDeleted = blocks.filter((b) => b.deletionTime === null)
      expect(nonDeleted).toHaveLength(0)
      const blockB = blocks.find((b) => b.blockNoteId === testBlockNoteId('block-b'))
      expect(blockB).toBeUndefined()
    })
  })

  it('deletes all existing blocks when document content becomes empty', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Empty Content Test',
      parentId: null,
    })

    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockNoteId: testBlockNoteId('a'),
    })
    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockNoteId: testBlockNoteId('b'),
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignId,
      documentId: noteId,
      update: makeYjsUpdate(),
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
      expect(blocks).toHaveLength(0)
    })
  })

  it('persists deeply nested blocks with correct hierarchy', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Nested Test',
      parentId: null,
    })

    await pushAndPersist(dmAuth, ctx.campaignId, noteId, [
      {
        id: testBlockNoteId('root'),
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: 'Root', styles: {} }],
        children: [
          {
            id: testBlockNoteId('child'),
            type: 'bulletListItem',
            props: {},
            content: [{ type: 'text', text: 'Child', styles: {} }],
            children: [
              {
                id: testBlockNoteId('grandchild'),
                type: 'paragraph',
                props: {},
                content: [{ type: 'text', text: 'Grandchild', styles: {} }],
                children: [],
              },
            ],
          },
        ],
      },
    ])

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteId))
        .collect()
      expect(blocks).toHaveLength(3)

      const root = blocks.find((b) => b.blockNoteId === testBlockNoteId('root'))!
      const child = blocks.find((b) => b.blockNoteId === testBlockNoteId('child'))!
      const grandchild = blocks.find((b) => b.blockNoteId === testBlockNoteId('grandchild'))!

      expect(root).toMatchObject({ parentBlockId: null, depth: 0, position: 0, plainText: 'Root' })
      expect(child).toMatchObject({
        parentBlockId: testBlockNoteId('root'),
        depth: 1,
        position: 0,
        plainText: 'Child',
      })
      expect(grandchild).toMatchObject({
        parentBlockId: testBlockNoteId('child'),
        depth: 2,
        position: 0,
        plainText: 'Grandchild',
      })
    })
  })

  it('replaces factory-seeded blocks not present in Yjs payload', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Coexist Test',
      parentId: null,
    })

    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockNoteId: testBlockNoteId('existing'),
    })

    await pushAndPersist(dmAuth, ctx.campaignId, noteId, [
      {
        id: testBlockNoteId('new-block'),
        type: 'heading',
        props: { level: 1 },
        content: [{ type: 'text', text: 'New', styles: {} }],
        children: [],
      },
    ])

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteId))
        .collect()
      const nonDeleted = blocks.filter((b) => b.deletionTime === null)
      const newBlock = nonDeleted.find((b) => b.blockNoteId === testBlockNoteId('new-block'))
      expect(newBlock).toBeDefined()
      expect(newBlock!.type).toBe('heading')
      expect(newBlock!.plainText).toBe('New')
      const existing = nonDeleted.find((b) => b.blockNoteId === testBlockNoteId('existing'))
      expect(existing).toBeUndefined()
    })
  })

  it('persists 5-level deep nesting via YDoc pipeline', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Deep Nesting',
      parentId: null,
    })

    await pushAndPersist(dmAuth, ctx.campaignId, noteId, [
      {
        id: testBlockNoteId('d0'),
        type: 'toggleListItem',
        props: {},
        content: [{ type: 'text', text: 'Level 0', styles: {} }],
        children: [
          {
            id: testBlockNoteId('d1'),
            type: 'bulletListItem',
            props: {},
            content: [{ type: 'text', text: 'Level 1', styles: {} }],
            children: [
              {
                id: testBlockNoteId('d2'),
                type: 'paragraph',
                props: {},
                content: [{ type: 'text', text: 'Level 2', styles: {} }],
                children: [
                  {
                    id: testBlockNoteId('d3'),
                    type: 'checkListItem',
                    props: {},
                    content: [{ type: 'text', text: 'Level 3', styles: {} }],
                    children: [
                      {
                        id: testBlockNoteId('d4'),
                        type: 'paragraph',
                        props: {},
                        content: [{ type: 'text', text: 'Level 4', styles: {} }],
                        children: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ])

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteId))
        .collect()
      expect(blocks).toHaveLength(5)

      for (let i = 0; i < 5; i++) {
        const block = blocks.find((b) => b.blockNoteId === testBlockNoteId(`d${i}`))!
        expect(block.depth).toBe(i)
        expect(block.parentBlockId).toBe(i === 0 ? null : testBlockNoteId(`d${i - 1}`))
        expect(block.plainText).toBe(`Level ${i}`)
      }
    })
  })

  it('handles simultaneous insert, update, and delete in a single persist', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Mixed Ops',
      parentId: null,
    })

    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockNoteId: testBlockNoteId('will-update'),
      shareStatus: 'all_shared',
    })
    const { blockDbId: deleteId } = await createBlock(
      t,
      noteId,
      ctx.campaignId,
      ctx.dm.profile._id,
      {
        blockNoteId: testBlockNoteId('will-delete'),
      },
    )

    await pushAndPersist(dmAuth, ctx.campaignId, noteId, [
      {
        id: testBlockNoteId('will-update'),
        type: 'heading',
        props: { level: 1 },
        content: [{ type: 'text', text: 'Updated', styles: {} }],
        children: [],
      },
      {
        id: testBlockNoteId('will-insert'),
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: 'New', styles: {} }],
        children: [],
      },
    ])

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteId))
        .collect()
      const nonDeleted = blocks.filter((b) => b.deletionTime === null)
      expect(nonDeleted).toHaveLength(2)

      const updated = nonDeleted.find((b) => b.blockNoteId === testBlockNoteId('will-update'))!
      expect(updated.type).toBe('heading')
      expect(updated.shareStatus).toBe('all_shared')
      expect(updated.updatedTime).not.toBeNull()

      const inserted = nonDeleted.find((b) => b.blockNoteId === testBlockNoteId('will-insert'))!
      expect(inserted.type).toBe('paragraph')
      expect(inserted.plainText).toBe('New')
      expect(inserted.shareStatus).toBe('not_shared')

      const deleted = await dbCtx.db.get('blocks', deleteId)
      expect(deleted).toBeNull()
    })
  })
})
