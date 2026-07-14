import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext, setupUser } from '../../_test/identities.helper'
import { createBlock, createNote, testBlockNoteId } from '../../_test/factories.helper'
import { expectPermissionDenied } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { SHARE_STATUS } from '../../../shared/block-shares/share-status'

describe('searchBlocks', () => {
  const t = createTestContext()

  it('returns empty array for empty query', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.query(api.blocks.queries.searchBlocks, {
      campaignId: ctx.campaignDomainId,
      query: '',
    })
    expect(result).toEqual([])
  })

  it('returns empty array for whitespace-only query', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.query(api.blocks.queries.searchBlocks, {
      campaignId: ctx.campaignDomainId,
      query: '   ',
    })
    expect(result).toEqual([])
  })

  it('finds blocks matching the query text', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('block-1'),
      plainText: 'The ancient dragon sleeps',
      type: 'paragraph',
    })
    await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('block-2'),
      plainText: 'A goblin attacks',
      type: 'paragraph',
    })

    const result = await dmAuth.query(api.blocks.queries.searchBlocks, {
      campaignId: ctx.campaignDomainId,
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
    await createBlock(t, note1, ctx1.campaignId, {
      plainText: 'dragon in campaign one',
      type: 'paragraph',
    })

    const ctx2 = await setupCampaignContext(t)
    const dm2 = asDm(ctx2)
    const { noteId: note2 } = await createNote(t, ctx2.campaignId, ctx2.dm.profile._id)
    await createBlock(t, note2, ctx2.campaignId, {
      plainText: 'dragon in campaign two',
      type: 'paragraph',
    })

    const results1 = await dm1.query(api.blocks.queries.searchBlocks, {
      campaignId: ctx1.campaignDomainId,
      query: 'dragon',
    })
    const results2 = await dm2.query(api.blocks.queries.searchBlocks, {
      campaignId: ctx2.campaignDomainId,
      query: 'dragon',
    })

    expect(results1).toHaveLength(1)
    expect(results1[0].plainText).toBe('dragon in campaign one')
    expect(results2).toHaveLength(1)
    expect(results2[0].plainText).toBe('dragon in campaign two')
  })

  it('only returns existing blocks', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createBlock(t, noteId, ctx.campaignId, {
      plainText: 'visible dragon',
      type: 'paragraph',
    })

    const result = await dmAuth.query(api.blocks.queries.searchBlocks, {
      campaignId: ctx.campaignDomainId,
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

    await createBlock(t, noteA, ctx.campaignId, {
      plainText: 'dragon in note A',
      type: 'paragraph',
    })
    await createBlock(t, noteB, ctx.campaignId, {
      plainText: 'dragon in note B',
      type: 'paragraph',
    })

    const result = await dmAuth.query(api.blocks.queries.searchBlocks, {
      campaignId: ctx.campaignDomainId,
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

    await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('shape-check'),
      plainText: 'checking result shape',
      type: 'heading',
    })

    const result = await dmAuth.query(api.blocks.queries.searchBlocks, {
      campaignId: ctx.campaignDomainId,
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
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      allPermissionLevel: PERMISSION_LEVEL.VIEW,
    })

    await createBlock(t, noteId, ctx.campaignId, {
      plainText: 'player searchable content',
      shareStatus: SHARE_STATUS.ALL_SHARED,
      type: 'paragraph',
    })

    const result = await playerAuth.query(api.blocks.queries.searchBlocks, {
      campaignId: ctx.campaignDomainId,
      query: 'player',
    })

    expect(result).toHaveLength(1)
  })

  it('omits blocks from notes the member cannot view', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId: hiddenNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId: visibleNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      allPermissionLevel: PERMISSION_LEVEL.VIEW,
    })

    await createBlock(t, hiddenNoteId, ctx.campaignId, {
      plainText: 'private sentinel',
      type: 'paragraph',
    })
    await createBlock(t, visibleNoteId, ctx.campaignId, {
      plainText: 'visible sentinel',
      shareStatus: SHARE_STATUS.ALL_SHARED,
      type: 'paragraph',
    })

    const result = await playerAuth.query(api.blocks.queries.searchBlocks, {
      campaignId: ctx.campaignDomainId,
      query: 'sentinel',
    })

    expect(result).toHaveLength(1)
    expect(result[0].plainText).toBe('visible sentinel')
    expect(result[0].noteId).toBe(visibleNoteId)
  })

  it('omits block text hidden by block visibility', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      allPermissionLevel: PERMISSION_LEVEL.VIEW,
    })

    await createBlock(t, noteId, ctx.campaignId, {
      plainText: 'visible clue',
      shareStatus: SHARE_STATUS.ALL_SHARED,
      type: 'paragraph',
    })
    await createBlock(t, noteId, ctx.campaignId, {
      plainText: 'hidden clue',
      shareStatus: SHARE_STATUS.INDIVIDUALLY_SHARED,
      type: 'paragraph',
    })

    const result = await playerAuth.query(api.blocks.queries.searchBlocks, {
      campaignId: ctx.campaignDomainId,
      query: 'clue',
    })

    expect(result.map((block) => block.plainText)).toEqual(['visible clue'])
  })

  it('lets a DM preview block search as a selected player', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      allPermissionLevel: PERMISSION_LEVEL.VIEW,
    })

    await createBlock(t, noteId, ctx.campaignId, {
      plainText: 'visible preview clue',
      shareStatus: SHARE_STATUS.ALL_SHARED,
      type: 'paragraph',
    })
    await createBlock(t, noteId, ctx.campaignId, {
      plainText: 'hidden preview clue',
      shareStatus: SHARE_STATUS.INDIVIDUALLY_SHARED,
      type: 'paragraph',
    })

    const result = await dmAuth.query(api.blocks.queries.searchBlocksAsMember, {
      campaignId: ctx.campaignDomainId,
      campaignMemberId: ctx.player.memberDomainId,
      query: 'preview clue',
    })

    expect(result.map((block) => block.plainText)).toEqual(['visible preview clue'])
  })

  it('denies access to non-members', async () => {
    const ctx = await setupCampaignContext(t)
    const outsider = await setupUser(t)

    await expectPermissionDenied(
      outsider.authed.query(api.blocks.queries.searchBlocks, {
        campaignId: ctx.campaignDomainId,
        query: 'anything',
      }),
    )
  })
})

describe('getHeadingsByNote', () => {
  const t = createTestContext()

  it('returns no headings from notes the member cannot view', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createBlock(t, noteId, ctx.campaignId, {
      plainText: 'Private Heading',
      type: 'heading',
    })

    const result = await playerAuth.query(api.blocks.queries.getHeadingsByNote, {
      campaignId: ctx.campaignDomainId,
      noteId,
    })

    expect(result).toEqual([])
  })

  it('omits heading blocks hidden by block visibility', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      allPermissionLevel: PERMISSION_LEVEL.VIEW,
    })

    await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('visible-heading'),
      plainText: 'Visible Heading',
      shareStatus: SHARE_STATUS.ALL_SHARED,
      type: 'heading',
    })
    await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('hidden-heading'),
      plainText: 'Hidden Heading',
      shareStatus: SHARE_STATUS.INDIVIDUALLY_SHARED,
      type: 'heading',
    })

    const result = await playerAuth.query(api.blocks.queries.getHeadingsByNote, {
      campaignId: ctx.campaignDomainId,
      noteId,
    })

    expect(result.map((heading) => heading.text)).toEqual(['Visible Heading'])
  })
})
