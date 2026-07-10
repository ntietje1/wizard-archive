import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createNote, createSidebarShare } from '../../_test/factories.helper'
import { api } from '../../_generated/api'
import {
  paragraphWithGeneratedId,
  replaceNoteDocumentAndPersist,
  valueBlockWithGeneratedId,
  valueInline,
} from './helpers.helper'

describe('saveAllNoteValuesForNote', () => {
  const t = createTestContext()

  it('persists same-note value formulas without resolving the campaign sidebar tree', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Local Values',
    })

    for (let index = 0; index < 20; index += 1) {
      await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        name: `Irrelevant ${index}`,
      })
    }

    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignId,
      noteId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'local-base',
          valueId: 'value-base',
          slug: 'base',
          expressionSource: '2',
        }),
        valueBlockWithGeneratedId({
          idSeed: 'local-total',
          valueId: 'value-total',
          slug: 'total',
          expressionSource: '[[base]] + 3',
        }),
      ],
    })

    const states = await dmAuth.query(api.noteValues.queries.getNoteValueStates, {
      campaignId: ctx.campaignId,
      noteId,
    })
    expect(states.find((state) => state.valueId === 'value-total')).toMatchObject({
      status: 'ok',
      rawValue: 5,
    })
  })

  it('persists invalid function usage as a compile error row', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Invalid Function Value Note',
    })

    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignId,
      noteId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'invalid-function-value',
          valueId: 'value-invalid-function',
          slug: 'invalid_function',
          expressionSource: 'foo(1)',
        }),
      ],
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
        slug: 'invalid_function',
        expressionSource: 'foo(1)',
        compile: {
          status: 'error',
          errorCode: 'invalid_function_usage',
          errorMessage: 'Unknown function "foo"',
        },
      })
    })
  })

  it('persists inline value formulas from paragraph content', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Inline Values',
    })

    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignId,
      noteId,
      blocks: [
        paragraphWithGeneratedId({
          idSeed: 'inline-values-paragraph',
          content: [
            { type: 'text', text: 'Stats ', styles: {} },
            valueInline({
              valueId: 'value-base',
              slug: 'base',
              expressionSource: '2',
            }),
            { type: 'text', text: ' and ', styles: {} },
            valueInline({
              valueId: 'value-total',
              slug: 'total',
              expressionSource: '[[base]] + 3',
            }),
          ],
        }),
      ],
    })

    const states = await dmAuth.query(api.noteValues.queries.getNoteValueStates, {
      campaignId: ctx.campaignId,
      noteId,
    })
    expect(states).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ valueId: 'value-base', slug: 'base', rawValue: 2 }),
        expect.objectContaining({ valueId: 'value-total', slug: 'total', rawValue: 5 }),
      ]),
    )
  })

  it('returns value states for multiple notes without duplicating repeated note ids', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId: firstNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'First Values',
    })
    const { noteId: secondNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Second Values',
    })

    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignId,
      noteId: firstNoteId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'first-value',
          valueId: 'value-first',
          slug: 'first',
          expressionSource: '1',
        }),
      ],
    })
    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignId,
      noteId: secondNoteId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'second-value',
          valueId: 'value-second',
          slug: 'second',
          expressionSource: '2',
        }),
      ],
    })

    const states = await dmAuth.query(api.noteValues.queries.getNoteValueStatesByNotes, {
      campaignId: ctx.campaignId,
      noteIds: [firstNoteId, secondNoteId, firstNoteId],
    })

    expect(states).toHaveLength(2)
    expect(states).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ noteId: firstNoteId, valueId: 'value-first', rawValue: 1 }),
        expect.objectContaining({ noteId: secondNoteId, valueId: 'value-second', rawValue: 2 }),
      ]),
    )
  })

  it('does not persist bindings or distinguish references to notes hidden from the editor', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)
    const { noteId: hiddenNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Hidden Values',
    })
    const { noteId: editableNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Player Formula',
    })
    const formulaBlock = valueBlockWithGeneratedId({
      idSeed: 'hidden-reference',
      valueId: 'value-hidden-reference',
      slug: 'hidden_reference',
      expressionSource: '[[Hidden Values.secret]] + 1',
    })

    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignId,
      noteId: hiddenNoteId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'hidden-value',
          valueId: 'value-secret',
          slug: 'secret',
          expressionSource: '41',
        }),
      ],
    })
    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignId,
      noteId: editableNoteId,
      blocks: [formulaBlock],
    })
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: editableNoteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    await replaceNoteDocumentAndPersist(t, playerAuth, {
      campaignId: ctx.campaignId,
      noteId: editableNoteId,
      blocks: [formulaBlock],
    })

    await t.run(async (dbCtx) => {
      const row = await dbCtx.db
        .query('noteValues')
        .withIndex('by_campaign_note', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('noteId', editableNoteId),
        )
        .unique()
      expect(row).toMatchObject({
        compile: {
          status: 'error',
          errorCode: 'unknown_reference',
        },
      })
      expect(JSON.stringify(row)).not.toContain(hiddenNoteId)
    })

    const states = await playerAuth.query(api.noteValues.queries.getNoteValueStates, {
      campaignId: ctx.campaignId,
      noteId: editableNoteId,
    })
    expect(states[0]).toMatchObject({
      status: 'error',
      errorCode: 'unknown_reference',
    })
  })
})
