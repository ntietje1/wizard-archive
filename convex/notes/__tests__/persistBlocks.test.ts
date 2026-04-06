import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import {
  asDm,
  asPlayer,
  setupCampaignContext,
} from '../../_test/identities.helper'
import { createNote, createSidebarShare } from '../../_test/factories.helper'
import {
  expectNotAuthenticated,
  expectPermissionDenied,
} from '../../_test/assertions.helper'
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
      parentId: null,
    })

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.notes.mutations.persistNoteBlocks, {
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
      parentId: null,
    })

    const result = await dmAuth.mutation(
      api.notes.mutations.persistNoteBlocks,
      {
        documentId: noteId,
      },
    )

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
      parentId: null,
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      documentId: noteId,
      update: makeYjsUpdate(),
    })

    const result = await dmAuth.mutation(
      api.notes.mutations.persistNoteBlocks,
      {
        documentId: noteId,
      },
    )

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
      parentId: null,
    })

    const blockIds = {
      heading: 'heading-block-1',
      paragraph: 'paragraph-block-1',
    }

    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
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

    const result = await dmAuth.mutation(
      api.notes.mutations.persistNoteBlocks,
      {
        documentId: noteId,
      },
    )

    expect(result).toBeNull()

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteId))
        .collect()

      expect(blocks.length).toBe(2)

      const headingBlock = blocks.find((b) => b.blockId === blockIds.heading)
      expect(headingBlock).toMatchObject({
        isTopLevel: true,
        content: { type: 'heading' },
        position: 0,
      })

      const paragraphBlock = blocks.find(
        (b) => b.blockId === blockIds.paragraph,
      )
      expect(paragraphBlock).toMatchObject({
        isTopLevel: true,
        content: { type: 'paragraph' },
        position: 1,
      })
    })
  })
})
