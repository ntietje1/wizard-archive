import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import {
  createCanvasViaFilesystem,
  createNoteViaFilesystem,
} from '../../_test/filesystemSetup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createNote, createSidebarShare, testBlockNoteId } from '../../_test/factories.helper'
import {
  expectNotAuthenticated,
  expectPermissionDenied,
  expectValidationFailed,
} from '../../_test/assertions.helper'
import { api, internal } from '../../_generated/api'
import {
  makeYjsUpdate,
  makeYjsUpdateWithBlocks,
} from '../../yjsSync/__tests__/makeYjsUpdate.helper'

describe('persistBlocks', () => {
  const t = createTestContext()

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotAuthenticated(
      t.action(api.notes.actions.persistNoteBlocks, {
        campaignId: ctx.campaignId,
        documentId: noteId,
      }),
    )
  })

  it('requires write access', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Write Access Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await expectPermissionDenied(
      playerAuth.action(api.notes.actions.persistNoteBlocks, {
        campaignId: ctx.campaignId,
        documentId: noteId,
      }),
    )
  })

  it('rejects non-note documents', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { canvasId } = await createCanvasViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Projection Canvas',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await expectValidationFailed(
      dmAuth.action(api.notes.actions.persistNoteBlocks, {
        campaignId: ctx.campaignId,
        documentId: canvasId,
      }),
    )
  })

  it('works on empty document without crash', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Empty Doc Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    const result = await dmAuth.action(api.notes.actions.persistNoteBlocks, {
      campaignId: ctx.campaignId,
      documentId: noteId,
    })

    expect(result).toBeNull()

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteId))
        .collect()

      expect(blocks.length).toBe(0)
    })
  })

  it('empty YDoc produces no blocks', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Persist Blocks Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignId,
      documentId: noteId,
      update: makeYjsUpdate(),
    })

    const result = await dmAuth.action(api.notes.actions.persistNoteBlocks, {
      campaignId: ctx.campaignId,
      documentId: noteId,
    })

    expect(result).toBeNull()

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteId))
        .collect()

      expect(blocks.length).toBe(0)
    })
  })

  it('persists blocks from a YDoc with content', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Content Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    const blockIds = {
      heading: 'heading-block-1',
      paragraph: 'paragraph-block-1',
    }

    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignId,
      documentId: noteId,
      update: makeYjsUpdateWithBlocks([
        {
          id: blockIds.heading,
          type: 'heading',
          props: { level: 1 },
          content: [{ type: 'text', text: 'Hello World', styles: {} }],
          children: [],
        },
        {
          id: blockIds.paragraph,
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: 'Some paragraph text', styles: {} }],
          children: [],
        },
      ]),
    })

    const result = await dmAuth.action(api.notes.actions.persistNoteBlocks, {
      campaignId: ctx.campaignId,
      documentId: noteId,
    })

    expect(result).toBeNull()

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteId))
        .collect()

      expect(blocks.length).toBe(2)

      const headingBlock = blocks.find((b) => b.blockNoteId === blockIds.heading)
      expect(headingBlock).toBeDefined()
      expect(headingBlock).toMatchObject({
        type: 'heading',
        parentBlockId: null,
        depth: 0,
        position: 0,
        plainText: 'Hello World',
      })

      const paragraphBlock = blocks.find((b) => b.blockNoteId === blockIds.paragraph)
      expect(paragraphBlock).toBeDefined()
      expect(paragraphBlock).toMatchObject({
        type: 'paragraph',
        parentBlockId: null,
        depth: 0,
        position: 1,
        plainText: 'Some paragraph text',
      })
    })
  })

  it('rejects malformed nested blocks before syncing derived data', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expect(
      t.mutation(internal.notes.internalMutations.syncDerivedDataFromBlocks, {
        noteId,
        content: [
          {
            id: 'root',
            type: 'paragraph',
            props: {},
            content: [],
            children: [{ id: 'child', type: 'unknown', props: {}, content: [] }],
          },
        ],
      }),
    ).rejects.toThrow(/Block type is invalid/)
  })

  it('rejects malformed table content before syncing derived data', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expect(
      t.mutation(internal.notes.internalMutations.syncDerivedDataFromBlocks, {
        noteId,
        content: [
          {
            id: 'table',
            type: 'table',
            props: {},
            content: {
              type: 'tableContent',
              columnWidths: [null],
              rows: [{ cells: [{ type: 'tableCell', content: [{ type: 'text' }] }] }],
            } as never,
          },
        ],
      }),
    ).rejects.toThrow()
  })

  it('persists non-text BlockNote blocks from canonical Yjs updates', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Rich Content Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignId,
      documentId: noteId,
      update: makeYjsUpdateWithBlocks([
        {
          id: 'table-block-1',
          type: 'table',
          props: { textColor: 'default' },
          content: {
            type: 'tableContent',
            columnWidths: [null, null],
            rows: [
              {
                cells: [
                  [{ type: 'text', text: 'A', styles: {} }],
                  [{ type: 'text', text: 'B', styles: {} }],
                ],
              },
            ],
          },
          children: [],
        },
        {
          id: 'image-block-1',
          type: 'image',
          props: {
            name: 'Preview',
            url: 'https://example.com/image.png',
            caption: 'A caption',
            backgroundColor: 'default',
            textAlignment: 'left',
            showPreview: true,
            previewWidth: 320,
          },
          children: [],
        },
      ]),
    })

    await dmAuth.action(api.notes.actions.persistNoteBlocks, {
      campaignId: ctx.campaignId,
      documentId: noteId,
    })

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteId))
        .collect()

      expect(blocks.map((block) => block.blockNoteId).sort()).toEqual([
        'image-block-1',
        'table-block-1',
      ])
    })
  })

  it('rebuilds extracted noteValues when inline values are persisted', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Value Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignId,
      documentId: noteId,
      update: makeYjsUpdateWithBlocks([
        {
          id: testBlockNoteId('value-paragraph'),
          type: 'paragraph',
          props: {},
          content: [
            {
              type: 'value',
              props: {
                valueId: 'value-1',
                slug: 'prof_bonus',
                expressionSource: '2',
              },
            },
          ],
        },
      ]),
    })

    await dmAuth.action(api.notes.actions.persistNoteBlocks, {
      campaignId: ctx.campaignId,
      documentId: noteId,
    })

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('noteValues')
        .withIndex('by_campaign_note', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('noteId', noteId),
        )
        .collect()

      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        slug: 'prof_bonus',
        expressionSource: '2',
      })
    })
  })
})
