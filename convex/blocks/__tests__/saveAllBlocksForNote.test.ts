import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { createNoteViaFilesystem } from '../../_test/filesystemSetup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import {
  executeMoveCommand,
  createBlock,
  createNote as createNoteRecord,
  createCanvas,
  getSidebarItemRowId,
  testBlock,
  testBlockNoteId,
} from '../../_test/factories.helper'
import { api } from '../../_generated/api'
import { makeYjsUpdate, makeYjsUpdateWithBlocks } from '../../_test/yjs.helper'
import { saveAllBlocksForNote } from '../functions/saveAllBlocksForNote'
import type { CampaignMutationCtx } from '../../functions'
import type { TableContent } from '@wizard-archive/editor/notes/document-contract'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'

async function pushAndPersist(
  dmAuth: ReturnType<typeof asDm>,
  campaignId: CampaignId,
  noteId: ResourceId,
  blocks: Parameters<typeof makeYjsUpdateWithBlocks>[0],
) {
  await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
    campaignId,
    documentId: noteId,
    update: makeYjsUpdateWithBlocks(blocks),
  })
  await dmAuth.action(api.notes.actions.persistNoteBlocks, {
    campaignId,
    documentId: noteId,
  })
}

describe('saveAllBlocksForNote — upsert and delete behavior', () => {
  const t = createTestContext()

  it('persists table content when inserting a new block', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteRowId } = await createNoteRecord(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Table Insert Test',
    })
    const tableContent: TableContent = {
      type: 'tableContent',
      columnWidths: [120],
      rows: [
        {
          cells: [
            { type: 'tableCell', content: [{ type: 'text', text: 'Cell value', styles: {} }] },
          ],
        },
      ],
    }

    const persistedBlocks = await t.run(async (dbCtx) => {
      return await saveAllBlocksForNote(dbCtx as unknown as CampaignMutationCtx, {
        noteId: noteRowId,
        content: [
          testBlock('table-block', {
            type: 'table',
            props: { textColor: 'default' },
            content: tableContent,
          }),
        ],
      })
    })

    expect(persistedBlocks).toHaveLength(1)
    expect(persistedBlocks[0].content).toEqual(tableContent)
    expect(persistedBlocks[0]).not.toHaveProperty('inlineContent')
  })

  it('returns final persisted rows in document order and excludes deleted blocks', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId, noteRowId } = await createNoteRecord(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Return Rows Test',
    })

    const { blockDbId: keptBlockId } = await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('kept'),
      plainText: 'Old kept text',
    })
    await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('removed'),
      plainText: 'Old removed text',
    })

    const persistedBlocks = await t.run(async (dbCtx) => {
      return await saveAllBlocksForNote(dbCtx as unknown as CampaignMutationCtx, {
        noteId: noteRowId,
        content: [
          testBlock('kept', {
            content: [{ type: 'text', text: 'Updated kept text', styles: {} }],
          }),
          testBlock('new', {
            content: [{ type: 'text', text: 'New block text', styles: {} }],
          }),
        ],
      })
    })

    expect(persistedBlocks).toHaveLength(2)
    expect(persistedBlocks.map((block) => block.blockNoteId)).toEqual([
      testBlockNoteId('kept'),
      testBlockNoteId('new'),
    ])
    expect(persistedBlocks[0]._id).toBe(keptBlockId)
    expect(persistedBlocks[0].plainText).toBe('Updated kept text')
    expect(persistedBlocks[1].plainText).toBe('New block text')

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteRowId))
        .collect()
      expect(blocks).toHaveLength(2)
      expect(
        blocks.find((block) => block.blockNoteId === testBlockNoteId('removed')),
      ).toBeUndefined()
    })
  })

  it('updates existing blocks in place rather than reinserting', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Update Test',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const noteRowId = await getSidebarItemRowId(t, noteId)

    await pushAndPersist(dmAuth, ctx.campaignDomainId, noteId, [
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
        .filter((q) => q.eq(q.field('noteId'), noteRowId))
        .collect()
      return blocks.find((b) => b.blockNoteId === testBlockNoteId('block-a'))!
    })

    await dmAuth.action(api.notes.actions.persistNoteBlocks, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
    })

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteRowId))
        .collect()
      expect(blocks).toHaveLength(1)
      const block = blocks[0]
      expect(block._id).toBe(originalBlock._id)
    })
  })

  it('hard-deletes blocks removed from document', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Delete Test',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const noteRowId = await getSidebarItemRowId(t, noteId)

    const { blockDbId: removedBlockId } = await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('remove'),
    })

    await pushAndPersist(dmAuth, ctx.campaignDomainId, noteId, [
      { id: testBlockNoteId('keep'), type: 'paragraph', props: {}, children: [] },
    ])

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteRowId))
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
    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Share Cascade Test',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const noteRowId = await getSidebarItemRowId(t, noteId)

    const { blockDbId } = await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('shared-block'),
      shareStatus: 'individually_shared',
    })

    const shareId = await t.run(async (dbCtx) => {
      return await dbCtx.db.insert('blockShares', {
        campaignId: ctx.campaignId,
        noteId: noteRowId,
        blockId: blockDbId,
        campaignMemberId: ctx.player.memberId,
        sessionId: null,
        permissionLevel: 'view',
      })
    })

    await pushAndPersist(dmAuth, ctx.campaignDomainId, noteId, [
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
    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Preserve Share Test',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const noteRowId = await getSidebarItemRowId(t, noteId)

    await pushAndPersist(dmAuth, ctx.campaignDomainId, noteId, [
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
        .filter((q) => q.eq(q.field('noteId'), noteRowId))
        .collect()
      await dbCtx.db.patch('blocks', blocks[0]._id, { shareStatus: 'all_shared' })
    })

    await dmAuth.action(api.notes.actions.persistNoteBlocks, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
    })

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteRowId))
        .collect()
      expect(blocks).toHaveLength(1)
      expect(blocks[0].shareStatus).toBe('all_shared')
    })
  })

  it('does not insert or delete blocks when note is soft-deleted', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Soft Delete Guard',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const noteRowId = await getSidebarItemRowId(t, noteId)

    await pushAndPersist(dmAuth, ctx.campaignDomainId, noteId, [
      { id: testBlockNoteId('block-a'), type: 'paragraph', props: {}, children: [] },
    ])

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'trash',
    })

    await t.run(async (dbCtx) => {
      await saveAllBlocksForNote(dbCtx as unknown as CampaignMutationCtx, {
        noteId: noteRowId,
        content: [
          { id: testBlockNoteId('block-a'), type: 'paragraph', props: {}, children: [] },
          { id: testBlockNoteId('block-b'), type: 'paragraph', props: {}, children: [] },
        ],
      })
    })

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteRowId))
        .collect()
      expect(blocks).toHaveLength(1)
      expect(blocks[0].blockNoteId).toBe(testBlockNoteId('block-a'))
    })
  })

  it('rejects sidebar item embeds that target the same note', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId, noteRowId } = await createNoteRecord(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Self Embed Guard',
    })

    await expect(
      t.run(async (dbCtx) => {
        return await saveAllBlocksForNote(dbCtx as unknown as CampaignMutationCtx, {
          noteId: noteRowId,
          content: [
            testBlock('self-embed', {
              type: 'embed',
              props: { targetKind: 'resource', resourceId: noteId },
            }),
          ],
        })
      }),
    ).rejects.toThrow(/cannot embed itself/i)

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .withIndex('by_campaign_note_block', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('noteId', noteRowId),
        )
        .collect()
      expect(blocks).toHaveLength(0)
    })
  })

  it('rejects malformed resource embed target ids before database lookup', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteRowId } = await createNoteRecord(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Malformed Embed Target Guard',
    })

    await expect(
      t.run(async (dbCtx) => {
        return await saveAllBlocksForNote(dbCtx as unknown as CampaignMutationCtx, {
          noteId: noteRowId,
          content: [
            testBlock('malformed-embed', {
              type: 'embed',
              props: { targetKind: 'resource', resourceId: 'not-a-convex-id' },
            }),
          ],
        })
      }),
    ).rejects.toThrow(/Invalid embed target resourceId for block/i)
  })

  it('rejects sidebar item embeds that target missing, inactive, or other-campaign items', async () => {
    const ctx = await setupCampaignContext(t)
    const otherCtx = await setupCampaignContext(t)
    const { noteRowId } = await createNoteRecord(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Embed Target Guard',
    })
    const { canvasId: activeCanvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Active Canvas',
    })
    const { canvasId: deletedCanvasId, canvasRowId: deletedCanvasRowId } = await createCanvas(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      {
        name: 'Deleted Canvas',
      },
    )
    const { canvasId: inactiveCanvasId } = await createCanvas(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      {
        name: 'Trashed Canvas',
      },
    )
    const { canvasId: otherCampaignCanvasId } = await createCanvas(
      t,
      otherCtx.campaignId,
      otherCtx.dm.profile._id,
      {
        name: 'Other Campaign Canvas',
      },
    )
    await executeMoveCommand(asDm(ctx), {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [inactiveCanvasId],
      targetParentId: null,
      action: 'trash',
    })
    await t.run(async (dbCtx) => {
      await dbCtx.db.delete('sidebarItems', deletedCanvasRowId)
    })

    async function expectRejectedTarget(resourceId: ResourceId, message: RegExp) {
      await expect(
        t.run(async (dbCtx) => {
          return await saveAllBlocksForNote(dbCtx as unknown as CampaignMutationCtx, {
            noteId: noteRowId,
            content: [
              testBlock(`embed-${resourceId}`, {
                type: 'embed',
                props: { targetKind: 'resource', resourceId },
              }),
            ],
          })
        }),
      ).rejects.toThrow(message)
    }

    await expectRejectedTarget(deletedCanvasId, /Embed target not found/i)
    await expectRejectedTarget(inactiveCanvasId, /Embed target is not an active sidebar item/i)
    await expectRejectedTarget(otherCampaignCanvasId, /Embed target belongs to different campaign/i)

    const persistedBlocks = await t.run(async (dbCtx) => {
      return await saveAllBlocksForNote(dbCtx as unknown as CampaignMutationCtx, {
        noteId: noteRowId,
        content: [
          testBlock('valid-embed', {
            type: 'embed',
            props: { targetKind: 'resource', resourceId: activeCanvasId },
          }),
        ],
      })
    })

    expect(persistedBlocks).toHaveLength(1)
    expect(persistedBlocks[0].props).toMatchObject({
      targetKind: 'resource',
      resourceId: activeCanvasId,
    })
  })

  it('deletes all existing blocks when document content becomes empty', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Empty Content Test',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const noteRowId = await getSidebarItemRowId(t, noteId)

    await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('a'),
    })
    await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('b'),
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      update: makeYjsUpdate(),
    })
    await dmAuth.action(api.notes.actions.persistNoteBlocks, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
    })

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteRowId))
        .collect()
      expect(blocks).toHaveLength(0)
    })
  })

  it('persists deeply nested blocks with correct hierarchy', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Nested Test',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const noteRowId = await getSidebarItemRowId(t, noteId)

    await pushAndPersist(dmAuth, ctx.campaignDomainId, noteId, [
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
        .filter((q) => q.eq(q.field('noteId'), noteRowId))
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
    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Coexist Test',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const noteRowId = await getSidebarItemRowId(t, noteId)

    await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('existing'),
    })

    await pushAndPersist(dmAuth, ctx.campaignDomainId, noteId, [
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
        .filter((q) => q.eq(q.field('noteId'), noteRowId))
        .collect()
      const newBlock = blocks.find((b) => b.blockNoteId === testBlockNoteId('new-block'))
      expect(newBlock).toBeDefined()
      expect(newBlock!.type).toBe('heading')
      expect(newBlock!.plainText).toBe('New')
      const existing = blocks.find((b) => b.blockNoteId === testBlockNoteId('existing'))
      expect(existing).toBeUndefined()
    })
  })

  it('persists 5-level deep nesting via YDoc pipeline', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Deep Nesting',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const noteRowId = await getSidebarItemRowId(t, noteId)

    await pushAndPersist(dmAuth, ctx.campaignDomainId, noteId, [
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
        .filter((q) => q.eq(q.field('noteId'), noteRowId))
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
    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Mixed Ops',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const noteRowId = await getSidebarItemRowId(t, noteId)

    await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('will-update'),
      shareStatus: 'all_shared',
    })
    const { blockDbId: deleteId } = await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('will-delete'),
    })

    await pushAndPersist(dmAuth, ctx.campaignDomainId, noteId, [
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
        .filter((q) => q.eq(q.field('noteId'), noteRowId))
        .collect()
      expect(blocks).toHaveLength(2)

      const updated = blocks.find((b) => b.blockNoteId === testBlockNoteId('will-update'))!
      expect(updated.type).toBe('heading')
      expect(updated.shareStatus).toBe('all_shared')

      const inserted = blocks.find((b) => b.blockNoteId === testBlockNoteId('will-insert'))!
      expect(inserted.type).toBe('paragraph')
      expect(inserted.plainText).toBe('New')
      expect(inserted.shareStatus).toBe('not_shared')

      const deleted = await dbCtx.db.get('blocks', deleteId)
      expect(deleted).toBeNull()
    })
  })
})
