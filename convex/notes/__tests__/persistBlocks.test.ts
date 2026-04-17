import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createNote, createSidebarShare } from '../../_test/factories.helper'
import { expectNotAuthenticated, expectPermissionDenied } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'
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
      t.mutation(api.notes.mutations.persistNoteBlocks, {
        campaignId: ctx.campaignId,
        documentId: noteId,
      }),
    )
  })

  it('requires write access', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
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
      playerAuth.mutation(api.notes.mutations.persistNoteBlocks, {
        campaignId: ctx.campaignId,
        documentId: noteId,
      }),
    )
  })

  it('works on empty document without crash', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Empty Doc Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    const result = await dmAuth.mutation(api.notes.mutations.persistNoteBlocks, {
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

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Persist Blocks Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignId,
      documentId: noteId,
      update: makeYjsUpdate(),
    })

    const result = await dmAuth.mutation(api.notes.mutations.persistNoteBlocks, {
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

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
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

    const result = await dmAuth.mutation(api.notes.mutations.persistNoteBlocks, {
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
})
