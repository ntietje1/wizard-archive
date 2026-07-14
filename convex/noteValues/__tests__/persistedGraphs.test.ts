import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createNote } from '../../_test/factories.helper'
import { api } from '../../_generated/api'
import { replaceNoteDocumentAndPersist, valueBlockWithGeneratedId } from './helpers.helper'

describe('persisted note value graphs', () => {
  const t = createTestContext()

  it('evaluates multi-hop cross-note dependency chains', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: noteCId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Note C',
    })
    const { noteId: noteBId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Note B',
    })
    const { noteId: noteAId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Note A',
    })

    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId: noteCId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'note-c-base',
          valueId: 'value-c-base',
          slug: 'base',
          expressionSource: '2',
        }),
      ],
    })
    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId: noteBId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'note-b-mid',
          valueId: 'value-b-mid',
          slug: 'mid',
          expressionSource: '[[Note C.base]] + 1',
        }),
      ],
    })
    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId: noteAId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'note-a-top',
          valueId: 'value-a-top',
          slug: 'top',
          expressionSource: '[[Note B.mid]] + 3',
        }),
      ],
    })

    const states = await dmAuth.query(api.noteValues.queries.getNoteValueStates, {
      campaignId: ctx.campaignDomainId,
      noteId: noteAId,
    })

    expect(states).toHaveLength(1)
    expect(states[0]).toMatchObject({
      status: 'ok',
      rawValue: 6,
      formattedValue: '6',
    })
  })

  it('allows a cross-note path to revisit a different literal value in the root note', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: noteAId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Revisited A',
    })
    const { noteId: noteBId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Revisited B',
    })

    const base = valueBlockWithGeneratedId({
      idSeed: 'revisited-a-base',
      valueId: 'value-a-base',
      slug: 'base',
      expressionSource: '2',
    })
    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId: noteAId,
      blocks: [base],
    })
    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId: noteBId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'revisited-b-bonus',
          valueId: 'value-b-bonus',
          slug: 'bonus',
          expressionSource: '[[Revisited A.base]] + 3',
        }),
      ],
    })
    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId: noteAId,
      blocks: [
        base,
        valueBlockWithGeneratedId({
          idSeed: 'revisited-a-total',
          valueId: 'value-a-total',
          slug: 'total',
          expressionSource: '[[Revisited B.bonus]] + 1',
        }),
      ],
    })

    const states = await dmAuth.query(api.noteValues.queries.getNoteValueStates, {
      campaignId: ctx.campaignDomainId,
      noteId: noteAId,
    })
    const bySlug = new Map(states.map((state) => [state.slug, state]))

    expect(bySlug.get('base')).toMatchObject({ status: 'ok', rawValue: 2 })
    expect(bySlug.get('total')).toMatchObject({ status: 'ok', rawValue: 6 })
  })

  it('surfaces cyclic dependency errors across notes', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: noteAId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Cycle A',
    })
    const { noteId: noteBId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Cycle B',
    })

    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId: noteAId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'cycle-a',
          valueId: 'value-cycle-a',
          slug: 'cycle_a',
          expressionSource: '1 + [[Cycle B.cycle_b]]',
        }),
      ],
    })
    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId: noteBId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'cycle-b',
          valueId: 'value-cycle-b',
          slug: 'cycle_b',
          expressionSource: '1 + [[Cycle A.cycle_a]]',
        }),
      ],
    })
    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId: noteAId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'cycle-a',
          valueId: 'value-cycle-a',
          slug: 'cycle_a',
          expressionSource: '1 + [[Cycle B.cycle_b]]',
        }),
      ],
    })

    const aStates = await dmAuth.query(api.noteValues.queries.getNoteValueStates, {
      campaignId: ctx.campaignDomainId,
      noteId: noteAId,
    })
    const bStates = await dmAuth.query(api.noteValues.queries.getNoteValueStates, {
      campaignId: ctx.campaignDomainId,
      noteId: noteBId,
    })

    expect(aStates[0]).toMatchObject({
      status: 'error',
      errorCode: 'cyclic_dependency',
    })
    expect(bStates[0]).toMatchObject({
      status: 'error',
      errorCode: 'cyclic_dependency',
    })
  })

  it('propagates dependency errors across note boundaries', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: noteCId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Error C',
    })
    const { noteId: noteBId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Error B',
    })
    const { noteId: noteAId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Error A',
    })

    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId: noteCId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'error-c',
          valueId: 'value-error-c',
          slug: 'broken',
          expressionSource: '1 / 0',
        }),
      ],
    })
    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId: noteBId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'error-b',
          valueId: 'value-error-b',
          slug: 'mid',
          expressionSource: '[[Error C.broken]] + 1',
        }),
      ],
    })
    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId: noteAId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'error-a',
          valueId: 'value-error-a',
          slug: 'top',
          expressionSource: '[[Error B.mid]] + 1',
        }),
      ],
    })

    const bStates = await dmAuth.query(api.noteValues.queries.getNoteValueStates, {
      campaignId: ctx.campaignDomainId,
      noteId: noteBId,
    })
    const aStates = await dmAuth.query(api.noteValues.queries.getNoteValueStates, {
      campaignId: ctx.campaignDomainId,
      noteId: noteAId,
    })

    expect(bStates[0]).toMatchObject({
      status: 'error',
      errorCode: 'dependency_error',
    })
    expect(aStates[0]).toMatchObject({
      status: 'error',
      errorCode: 'dependency_error',
    })
  })

  it('resolves mixed local and external dependency graphs in topological order', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: sourceNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Mixed Source',
    })
    const { noteId: targetNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Mixed Target',
    })

    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId: sourceNoteId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'mixed-source-base',
          valueId: 'value-source-base',
          slug: 'source_base',
          expressionSource: '2',
        }),
      ],
    })
    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId: targetNoteId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'mixed-target-local-base',
          valueId: 'value-local-base',
          slug: 'local_base',
          expressionSource: '5',
        }),
        valueBlockWithGeneratedId({
          idSeed: 'mixed-target-external-bonus',
          valueId: 'value-external-bonus',
          slug: 'external_bonus',
          expressionSource: '[[Mixed Source.source_base]] + 1',
        }),
        valueBlockWithGeneratedId({
          idSeed: 'mixed-target-combo',
          valueId: 'value-combo',
          slug: 'combo',
          expressionSource: '[[local_base]] + [[external_bonus]]',
        }),
        valueBlockWithGeneratedId({
          idSeed: 'mixed-target-total',
          valueId: 'value-total',
          slug: 'total',
          expressionSource: '[[combo]] * 2',
        }),
      ],
    })

    const states = await dmAuth.query(api.noteValues.queries.getNoteValueStates, {
      campaignId: ctx.campaignDomainId,
      noteId: targetNoteId,
    })
    const bySlug = new Map(states.map((state) => [state.slug, state]))

    expect(bySlug.get('local_base')).toMatchObject({
      status: 'ok',
      rawValue: 5,
    })
    expect(bySlug.get('external_bonus')).toMatchObject({
      status: 'ok',
      rawValue: 3,
    })
    expect(bySlug.get('combo')).toMatchObject({
      status: 'ok',
      rawValue: 8,
    })
    expect(bySlug.get('total')).toMatchObject({
      status: 'ok',
      rawValue: 16,
      formattedValue: '16',
    })
  })

  it('binds external formulas to the explicitly referenced note value', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: referencedNoteId, noteRowId: referencedNoteRowId } = await createNote(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      { name: 'Referenced Stats' },
    )
    const { noteId: unrelatedNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Unrelated Stats',
    })
    const { noteId: targetNoteId, noteRowId: targetNoteRowId } = await createNote(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      { name: 'Target Stats' },
    )

    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId: referencedNoteId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'referenced-score',
          valueId: 'value-referenced-score',
          slug: 'score',
          expressionSource: '7',
        }),
      ],
    })
    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId: unrelatedNoteId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'unrelated-score',
          valueId: 'value-unrelated-score',
          slug: 'score',
          expressionSource: '99',
        }),
      ],
    })
    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId: targetNoteId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'target-total',
          valueId: 'value-target-total',
          slug: 'total',
          expressionSource: '[[Referenced Stats.score]] + 1',
        }),
      ],
    })

    const rows = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('noteValues')
        .withIndex('by_campaign_note', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('noteId', targetNoteRowId),
        )
        .collect()
    })

    expect(rows[0].compile.status === 'ok' ? rows[0].compile.bindings : []).toEqual([
      {
        key: 'ref_0',
        targetNoteId: referencedNoteRowId,
        targetValueId: 'value-referenced-score',
      },
    ])

    const states = await dmAuth.query(api.noteValues.queries.getNoteValueStates, {
      campaignId: ctx.campaignDomainId,
      noteId: targetNoteId,
    })
    expect(states[0]).toMatchObject({
      status: 'ok',
      rawValue: 8,
    })
  })

  it('does not resolve values from undo-hidden dependency notes', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: sourceNoteId, noteRowId: sourceNoteRowId } = await createNote(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      {
        name: 'Hidden Source',
      },
    )
    const { noteId: targetNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Hidden Target',
    })

    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId: sourceNoteId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'hidden-source-base',
          valueId: 'value-source-base',
          slug: 'base',
          expressionSource: '2',
        }),
      ],
    })
    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId: targetNoteId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'hidden-target-total',
          valueId: 'value-target-total',
          slug: 'total',
          expressionSource: '[[Hidden Source.base]] + 1',
        }),
      ],
    })

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', sourceNoteRowId, { status: 'undoHidden' })
    })

    const states = await dmAuth.query(api.noteValues.queries.getNoteValueStates, {
      campaignId: ctx.campaignDomainId,
      noteId: targetNoteId,
    })

    expect(states[0]).toMatchObject({
      status: 'error',
      errorCode: 'missing_target',
    })
  })
})
