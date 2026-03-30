import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import {
  asDm,
  asPlayer,
  setupCampaignContext,
} from '../../_test/identities.helper'
import { createSidebarShare } from '../../_test/factories.helper'
import { api } from '../../_generated/api'

const paragraph = (id: string, text: string) => ({
  id,
  type: 'paragraph' as const,
  content: [{ type: 'text' as const, text, styles: {} }],
  props: {
    textColor: 'default',
    textAlignment: 'left',
    backgroundColor: 'default',
  },
  children: [],
})

describe('note content update + block share consistency', () => {
  const t = createTestContext()

  it('removing a not_shared block from content soft-deletes it', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Test Note',
      parentId: null,
    })

    await dmAuth.mutation(api.notes.mutations.updateNoteContent, {
      noteId,
      content: [paragraph('b1', 'First'), paragraph('b2', 'Second')],
    })

    await dmAuth.mutation(api.notes.mutations.updateNoteContent, {
      noteId,
      content: [paragraph('b2', 'Second')],
    })

    const blocks = await t.run(async (dbCtx) =>
      dbCtx.db
        .query('blocks')
        .withIndex('by_campaign_note_block', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('noteId', noteId),
        )
        .collect(),
    )

    const b1 = blocks.find((b) => b.blockId === 'b1')
    const b2 = blocks.find((b) => b.blockId === 'b2')

    expect(b1).toBeDefined()
    expect(b1!.isTopLevel).toBe(false)
    expect(b1!.deletionTime).not.toBeNull()

    expect(b2).toBeDefined()
    expect(b2!.isTopLevel).toBe(true)
    expect(b2!.deletionTime).toBeNull()
  })

  it('removing an all_shared block keeps the DB row alive (isTopLevel=false)', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Shared Blocks Note',
      parentId: null,
    })

    await dmAuth.mutation(api.notes.mutations.updateNoteContent, {
      noteId,
      content: [paragraph('shared-b', 'Shared'), paragraph('keep-b', 'Keep')],
    })

    const blockContent = (id: string) => ({
      blockNoteId: id,
      content: { id, type: 'paragraph' as const, content: [] },
    })

    await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
      noteId,
      blocks: [blockContent('shared-b')],
      status: 'all_shared',
    })

    await dmAuth.mutation(api.notes.mutations.updateNoteContent, {
      noteId,
      content: [paragraph('keep-b', 'Keep')],
    })

    const blocks = await t.run(async (dbCtx) =>
      dbCtx.db
        .query('blocks')
        .withIndex('by_campaign_note_block', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('noteId', noteId),
        )
        .collect(),
    )

    const sharedBlock = blocks.find((b) => b.blockId === 'shared-b')
    expect(sharedBlock).toBeDefined()
    expect(sharedBlock!.isTopLevel).toBe(false)
    expect(sharedBlock!.deletionTime).toBeNull()
    expect(sharedBlock!.shareStatus).toBe('all_shared')
  })

  it('new blocks via updateNoteContent default to not_shared', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Fresh Note',
      parentId: null,
    })

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await dmAuth.mutation(api.notes.mutations.updateNoteContent, {
      noteId,
      content: [
        paragraph('a', 'Alpha'),
        paragraph('b', 'Beta'),
        paragraph('c', 'Gamma'),
      ],
    })

    const dmView = await dmAuth.query(api.notes.queries.getNote, { noteId })
    for (const key of ['a', 'b', 'c']) {
      expect(dmView!.blockMeta[key].shareStatus).toBe('not_shared')
    }

    const playerView = await playerAuth.query(api.notes.queries.getNote, {
      noteId,
    })
    expect(Object.keys(playerView!.blockMeta)).toHaveLength(0)
  })

  it('re-adding a previously removed block reuses existing DB row', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Reuse Note',
      parentId: null,
    })

    await dmAuth.mutation(api.notes.mutations.updateNoteContent, {
      noteId,
      content: [paragraph('reuse-b', 'Original')],
    })

    const blocksBefore = await t.run(async (dbCtx) =>
      dbCtx.db
        .query('blocks')
        .withIndex('by_campaign_note_block', (q) =>
          q
            .eq('campaignId', ctx.campaignId)
            .eq('noteId', noteId)
            .eq('blockId', 'reuse-b'),
        )
        .collect(),
    )
    expect(blocksBefore).toHaveLength(1)

    await dmAuth.mutation(api.notes.mutations.updateNoteContent, {
      noteId,
      content: [paragraph('other-b', 'Different')],
    })

    await dmAuth.mutation(api.notes.mutations.updateNoteContent, {
      noteId,
      content: [paragraph('reuse-b', 'Re-added')],
    })

    const blocksAfter = await t.run(async (dbCtx) =>
      dbCtx.db
        .query('blocks')
        .withIndex('by_campaign_note_block', (q) =>
          q
            .eq('campaignId', ctx.campaignId)
            .eq('noteId', noteId)
            .eq('blockId', 'reuse-b'),
        )
        .collect(),
    )

    const activeBlocks = blocksAfter.filter((b) => b.isTopLevel)
    expect(activeBlocks).toHaveLength(1)
  })

  it('bulk status change + content update: shared blocks survive removal, unshared get deleted', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Bulk Note',
      parentId: null,
    })

    await dmAuth.mutation(api.notes.mutations.updateNoteContent, {
      noteId,
      content: [
        paragraph('s1', 'Shared 1'),
        paragraph('s2', 'Shared 2'),
        paragraph('s3', 'Shared 3'),
        paragraph('u1', 'Unshared 1'),
        paragraph('u2', 'Unshared 2'),
      ],
    })

    const blockContent = (id: string) => ({
      blockNoteId: id,
      content: { id, type: 'paragraph' as const, content: [] },
    })

    await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
      noteId,
      blocks: [blockContent('s1'), blockContent('s2'), blockContent('s3')],
      status: 'all_shared',
    })

    await dmAuth.mutation(api.notes.mutations.updateNoteContent, {
      noteId,
      content: [paragraph('s1', 'Shared 1'), paragraph('u1', 'Unshared 1')],
    })

    const blocks = await t.run(async (dbCtx) =>
      dbCtx.db
        .query('blocks')
        .withIndex('by_campaign_note_block', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('noteId', noteId),
        )
        .collect(),
    )

    const s1 = blocks.find((b) => b.blockId === 's1')
    expect(s1!.isTopLevel).toBe(true)
    expect(s1!.deletionTime).toBeNull()

    const s2 = blocks.find((b) => b.blockId === 's2')
    expect(s2!.isTopLevel).toBe(false)
    expect(s2!.deletionTime).toBeNull()

    const s3 = blocks.find((b) => b.blockId === 's3')
    expect(s3!.isTopLevel).toBe(false)
    expect(s3!.deletionTime).toBeNull()

    const u1 = blocks.find((b) => b.blockId === 'u1')
    expect(u1!.isTopLevel).toBe(true)
    expect(u1!.deletionTime).toBeNull()

    const u2 = blocks.find((b) => b.blockId === 'u2')
    expect(u2!.isTopLevel).toBe(false)
    expect(u2!.deletionTime).not.toBeNull()
  })
})
