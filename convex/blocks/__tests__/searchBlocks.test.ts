import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext, setupUser } from '../../_test/identities.helper'
import { createBlock, createNote, testBlockNoteId } from '../../_test/factories.helper'
import { expectPermissionDenied } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('searchBlocks', () => {
  const t = createTestContext()

  it('returns empty array for empty query', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.query(api.blocks.queries.searchBlocks, {
      campaignId: ctx.campaignId,
      query: '',
    })
    expect(result).toEqual([])
  })

  it('returns empty array for whitespace-only query', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.query(api.blocks.queries.searchBlocks, {
      campaignId: ctx.campaignId,
      query: '   ',
    })
    expect(result).toEqual([])
  })

  it('finds blocks matching the query text', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockNoteId: testBlockNoteId('block-1'),
      plainText: 'The ancient dragon sleeps',
      type: 'paragraph',
    })
    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockNoteId: testBlockNoteId('block-2'),
      plainText: 'A goblin attacks',
      type: 'paragraph',
    })

    const result = await dmAuth.query(api.blocks.queries.searchBlocks, {
      campaignId: ctx.campaignId,
      query: 'dragon',
    })

    expect(result).toHaveLength(1)
    expect(result[0].plainText).toBe('The ancient dragon sleeps')
    expect(result[0].noteId).toBe(noteId)
    expect(result[0].blockNoteId).toBe(testBlockNoteId('block-1'))
    expect(result[0].type).toBe('paragraph')
  })

  it('scopes results to the queried campaign', async () => {
    const ctx1 = await setupCampaignContext(t)
    const dm1 = asDm(ctx1)
    const { noteId: note1 } = await createNote(t, ctx1.campaignId, ctx1.dm.profile._id)
    await createBlock(t, note1, ctx1.campaignId, ctx1.dm.profile._id, {
      plainText: 'dragon in campaign one',
      type: 'paragraph',
    })

    const ctx2 = await setupCampaignContext(t)
    const dm2 = asDm(ctx2)
    const { noteId: note2 } = await createNote(t, ctx2.campaignId, ctx2.dm.profile._id)
    await createBlock(t, note2, ctx2.campaignId, ctx2.dm.profile._id, {
      plainText: 'dragon in campaign two',
      type: 'paragraph',
    })

    const results1 = await dm1.query(api.blocks.queries.searchBlocks, {
      campaignId: ctx1.campaignId,
      query: 'dragon',
    })
    const results2 = await dm2.query(api.blocks.queries.searchBlocks, {
      campaignId: ctx2.campaignId,
      query: 'dragon',
    })

    expect(results1).toHaveLength(1)
    expect(results1[0].plainText).toBe('dragon in campaign one')
    expect(results2).toHaveLength(1)
    expect(results2[0].plainText).toBe('dragon in campaign two')
  })

  it('excludes soft-deleted blocks', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      plainText: 'visible dragon',
      type: 'paragraph',
    })
    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      plainText: 'deleted dragon',
      type: 'paragraph',
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
    })

    const result = await dmAuth.query(api.blocks.queries.searchBlocks, {
      campaignId: ctx.campaignId,
      query: 'dragon',
    })

    expect(result).toHaveLength(1)
    expect(result[0].plainText).toBe('visible dragon')
  })

  it('returns blocks across multiple notes', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId: noteA } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId: noteB } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createBlock(t, noteA, ctx.campaignId, ctx.dm.profile._id, {
      plainText: 'dragon in note A',
      type: 'paragraph',
    })
    await createBlock(t, noteB, ctx.campaignId, ctx.dm.profile._id, {
      plainText: 'dragon in note B',
      type: 'paragraph',
    })

    const result = await dmAuth.query(api.blocks.queries.searchBlocks, {
      campaignId: ctx.campaignId,
      query: 'dragon',
    })

    expect(result).toHaveLength(2)
    const noteIds = new Set(result.map((r) => r.noteId))
    expect(noteIds.size).toBe(2)
    expect(noteIds.has(noteA)).toBe(true)
    expect(noteIds.has(noteB)).toBe(true)
  })

  it('returns correct shape for each result', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockNoteId: testBlockNoteId('shape-check'),
      plainText: 'checking result shape',
      type: 'heading',
    })

    const result = await dmAuth.query(api.blocks.queries.searchBlocks, {
      campaignId: ctx.campaignId,
      query: 'checking',
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      blockNoteId: testBlockNoteId('shape-check'),
      noteId,
      plainText: 'checking result shape',
      type: 'heading',
    })
  })

  it('allows a campaign member (player) to search', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      plainText: 'player searchable content',
      type: 'paragraph',
    })

    const result = await playerAuth.query(api.blocks.queries.searchBlocks, {
      campaignId: ctx.campaignId,
      query: 'player',
    })

    expect(result).toHaveLength(1)
  })

  it('denies access to non-members', async () => {
    const ctx = await setupCampaignContext(t)
    const outsider = await setupUser(t)

    await expectPermissionDenied(
      outsider.authed.query(api.blocks.queries.searchBlocks, {
        campaignId: ctx.campaignId,
        query: 'anything',
      }),
    )
  })
})
