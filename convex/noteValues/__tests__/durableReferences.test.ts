import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createNote } from '../../_test/factories.helper'
import { api } from '../../_generated/api'
import {
  renameValueTestNote,
  replaceNoteDocumentAndPersist,
  valueBlockWithGeneratedId,
} from './helpers.helper'
import type { TestBlock } from '../../yjsSync/__tests__/makeYjsUpdate.helper'

type CampaignContext = Awaited<ReturnType<typeof setupCampaignContext>>
type DmAuth = ReturnType<typeof asDm>

describe('note value durable references', () => {
  const t = createTestContext()

  async function createSourceAndTargetNotes(ctx: CampaignContext) {
    const { noteId: sourceNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Source Note',
    })
    const { noteId: targetNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Target Note',
    })
    return { sourceNoteId, targetNoteId }
  }

  function profBonusBlock({
    idSeed = 'source-prof-bonus',
    valueId = 'value-prof-bonus',
    slug = 'prof_bonus',
    expressionSource = '2',
  } = {}): TestBlock {
    return valueBlockWithGeneratedId({
      idSeed,
      valueId,
      slug,
      expressionSource,
    })
  }

  function attackBonusBlock(expressionSource = '3 + [[Source Note.prof_bonus]]'): TestBlock {
    return valueBlockWithGeneratedId({
      idSeed: 'target-attack-bonus',
      valueId: 'value-attack-bonus',
      slug: 'attack_bonus',
      expressionSource,
    })
  }

  async function persistBlocks(
    ctx: CampaignContext,
    dmAuth: DmAuth,
    noteId: Parameters<typeof replaceNoteDocumentAndPersist>[2]['noteId'],
    blocks: Array<TestBlock>,
  ) {
    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignId,
      noteId,
      blocks,
    })
  }

  async function getStates(
    ctx: CampaignContext,
    dmAuth: DmAuth,
    noteId: Parameters<typeof replaceNoteDocumentAndPersist>[2]['noteId'],
  ) {
    return await dmAuth.query(api.noteValues.queries.getNoteValueStates, {
      campaignId: ctx.campaignId,
      noteId,
    })
  }

  async function getRowsForNote(
    ctx: CampaignContext,
    noteId: Parameters<typeof replaceNoteDocumentAndPersist>[2]['noteId'],
  ) {
    return await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('noteValues')
        .withIndex('by_campaign_note', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('noteId', noteId),
        )
        .collect()
    })
  }

  async function getRowsForValue(
    ctx: CampaignContext,
    noteId: Parameters<typeof replaceNoteDocumentAndPersist>[2]['noteId'],
    valueId: string,
  ) {
    const rows = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('noteValues')
        .withIndex('by_campaign_note', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('noteId', noteId),
        )
        .collect()
    })
    return rows.filter((row) => row.valueId === valueId)
  }

  it('keeps durable external bindings working after source note rename and dependent re-persist', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { sourceNoteId, targetNoteId } = await createSourceAndTargetNotes(ctx)

    const sourceValueId = 'value-prof-bonus'
    const sourceBlocks = [profBonusBlock({ valueId: sourceValueId })]
    const targetBlocks = [attackBonusBlock()]

    await persistBlocks(ctx, dmAuth, sourceNoteId, sourceBlocks)
    await persistBlocks(ctx, dmAuth, targetNoteId, targetBlocks)

    let states = await getStates(ctx, dmAuth, targetNoteId)
    expect(states).toHaveLength(1)
    expect(states[0]).toMatchObject({
      status: 'ok',
      rawValue: 5,
      errorCode: null,
    })

    await renameValueTestNote(dmAuth, {
      campaignId: ctx.campaignId,
      noteId: sourceNoteId,
      name: 'Renamed Source Note',
    })

    states = await getStates(ctx, dmAuth, targetNoteId)
    expect(states[0]).toMatchObject({
      status: 'ok',
      rawValue: 5,
    })

    await persistBlocks(ctx, dmAuth, targetNoteId, targetBlocks)

    states = await getStates(ctx, dmAuth, targetNoteId)
    expect(states[0]).toMatchObject({
      status: 'ok',
      rawValue: 5,
    })

    const targetRows = await getRowsForNote(ctx, targetNoteId)
    expect(targetRows).toHaveLength(1)
    expect(targetRows[0]).toMatchObject({
      expressionSource: '3 + [[Source Note.prof_bonus]]',
      compileStatus: 'ok',
    })
    expect(targetRows[0].bindings).toEqual([
      {
        key: 'ref_0',
        targetNoteId: sourceNoteId,
        targetValueId: sourceValueId,
      },
    ])
  })

  it('does not rebind an unchanged external expression when the old note path points to another note', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { sourceNoteId, targetNoteId } = await createSourceAndTargetNotes(ctx)

    const sourceValueId = 'value-prof-bonus'
    const targetBlocks = [attackBonusBlock()]

    await persistBlocks(ctx, dmAuth, sourceNoteId, [profBonusBlock({ valueId: sourceValueId })])
    await persistBlocks(ctx, dmAuth, targetNoteId, targetBlocks)

    await renameValueTestNote(dmAuth, {
      campaignId: ctx.campaignId,
      noteId: sourceNoteId,
      name: 'Renamed Source Note',
    })

    const { noteId: replacementSourceNoteId } = await createNote(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      {
        name: 'Source Note',
      },
    )
    await persistBlocks(ctx, dmAuth, replacementSourceNoteId, [
      profBonusBlock({
        idSeed: 'replacement-source-prof-bonus',
        valueId: 'value-replacement-prof-bonus',
        expressionSource: '10',
      }),
    ])

    await persistBlocks(ctx, dmAuth, targetNoteId, targetBlocks)

    const states = await getStates(ctx, dmAuth, targetNoteId)
    expect(states[0]).toMatchObject({
      status: 'ok',
      rawValue: 5,
    })

    const targetRows = await getRowsForNote(ctx, targetNoteId)
    expect(targetRows[0].bindings).toEqual([
      {
        key: 'ref_0',
        targetNoteId: sourceNoteId,
        targetValueId: sourceValueId,
      },
    ])
  })

  it('keeps durable external bindings working after source value slug rename and dependent re-persist', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { sourceNoteId, targetNoteId } = await createSourceAndTargetNotes(ctx)

    const sourceValueId = 'value-prof-bonus'
    const targetBlocks = [attackBonusBlock()]

    await persistBlocks(ctx, dmAuth, sourceNoteId, [profBonusBlock({ valueId: sourceValueId })])
    await persistBlocks(ctx, dmAuth, targetNoteId, targetBlocks)

    await persistBlocks(ctx, dmAuth, sourceNoteId, [
      profBonusBlock({ valueId: sourceValueId, slug: 'proficiency_bonus' }),
    ])

    let states = await getStates(ctx, dmAuth, targetNoteId)
    expect(states[0]).toMatchObject({
      status: 'ok',
      rawValue: 5,
    })

    await persistBlocks(ctx, dmAuth, targetNoteId, targetBlocks)

    states = await getStates(ctx, dmAuth, targetNoteId)
    expect(states[0]).toMatchObject({
      status: 'ok',
      rawValue: 5,
    })

    const targetRows = await getRowsForNote(ctx, targetNoteId)
    expect(targetRows[0]).toMatchObject({
      expressionSource: '3 + [[Source Note.prof_bonus]]',
      compileStatus: 'ok',
    })
    expect(targetRows[0].bindings).toEqual([
      {
        key: 'ref_0',
        targetNoteId: sourceNoteId,
        targetValueId: sourceValueId,
      },
    ])
  })

  it('does not rebind an unchanged external expression when the old slug points to another value', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { sourceNoteId, targetNoteId } = await createSourceAndTargetNotes(ctx)

    const sourceValueId = 'value-prof-bonus'
    const targetBlocks = [attackBonusBlock()]

    await persistBlocks(ctx, dmAuth, sourceNoteId, [profBonusBlock({ valueId: sourceValueId })])
    await persistBlocks(ctx, dmAuth, targetNoteId, targetBlocks)

    await persistBlocks(ctx, dmAuth, sourceNoteId, [
      profBonusBlock({ valueId: sourceValueId, slug: 'renamed_prof_bonus' }),
      profBonusBlock({
        idSeed: 'source-replacement-prof-bonus',
        valueId: 'value-replacement-prof-bonus',
        expressionSource: '10',
      }),
    ])

    await persistBlocks(ctx, dmAuth, targetNoteId, targetBlocks)

    const states = await getStates(ctx, dmAuth, targetNoteId)
    expect(states[0]).toMatchObject({
      status: 'ok',
      rawValue: 5,
    })

    const targetRows = await getRowsForNote(ctx, targetNoteId)
    expect(targetRows[0].bindings).toEqual([
      {
        key: 'ref_0',
        targetNoteId: sourceNoteId,
        targetValueId: sourceValueId,
      },
    ])
  })

  it('does rebind an unchanged same-note expression when a local slug points to a replacement value', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Local Rebind Note',
    })

    const targetValueId = 'value-total'
    const targetBlock = valueBlockWithGeneratedId({
      idSeed: 'local-target',
      valueId: targetValueId,
      slug: 'total',
      expressionSource: '[[base]] + 1',
    })

    await persistBlocks(ctx, dmAuth, noteId, [
      valueBlockWithGeneratedId({
        idSeed: 'local-original-base',
        valueId: 'value-original-base',
        slug: 'base',
        expressionSource: '2',
      }),
      targetBlock,
    ])

    await persistBlocks(ctx, dmAuth, noteId, [
      valueBlockWithGeneratedId({
        idSeed: 'local-replacement-base',
        valueId: 'value-replacement-base',
        slug: 'base',
        expressionSource: '10',
      }),
      targetBlock,
    ])

    const states = await getStates(ctx, dmAuth, noteId)
    expect(states.find((state) => state.valueId === targetValueId)).toMatchObject({
      status: 'ok',
      rawValue: 11,
    })

    const targetRows = await getRowsForValue(ctx, noteId, targetValueId)
    expect(targetRows[0].bindings).toEqual([
      {
        key: 'ref_0',
        targetNoteId: noteId,
        targetValueId: 'value-replacement-base',
      },
    ])
  })

  it('rebinding local refs does not weaken durable external refs in the same unchanged expression', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { sourceNoteId, targetNoteId } = await createSourceAndTargetNotes(ctx)

    const sourceValueId = 'value-prof-bonus'
    const targetValueId = 'value-total'
    const targetBlock = valueBlockWithGeneratedId({
      idSeed: 'mixed-target-total',
      valueId: targetValueId,
      slug: 'total',
      expressionSource: '[[base]] + [[Source Note.prof_bonus]]',
    })

    await persistBlocks(ctx, dmAuth, sourceNoteId, [profBonusBlock({ valueId: sourceValueId })])
    await persistBlocks(ctx, dmAuth, targetNoteId, [
      valueBlockWithGeneratedId({
        idSeed: 'mixed-original-base',
        valueId: 'value-original-base',
        slug: 'base',
        expressionSource: '3',
      }),
      targetBlock,
    ])

    await renameValueTestNote(dmAuth, {
      campaignId: ctx.campaignId,
      noteId: sourceNoteId,
      name: 'Renamed Source Note',
    })
    const { noteId: replacementSourceNoteId } = await createNote(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      {
        name: 'Source Note',
      },
    )
    await persistBlocks(ctx, dmAuth, replacementSourceNoteId, [
      profBonusBlock({
        idSeed: 'replacement-source-prof-bonus',
        valueId: 'value-replacement-prof-bonus',
        expressionSource: '10',
      }),
    ])
    await persistBlocks(ctx, dmAuth, targetNoteId, [
      valueBlockWithGeneratedId({
        idSeed: 'mixed-replacement-base',
        valueId: 'value-replacement-base',
        slug: 'base',
        expressionSource: '7',
      }),
      targetBlock,
    ])

    const states = await getStates(ctx, dmAuth, targetNoteId)
    expect(states.find((state) => state.valueId === targetValueId)).toMatchObject({
      status: 'ok',
      rawValue: 9,
    })

    const targetRows = await getRowsForValue(ctx, targetNoteId, targetValueId)
    expect(targetRows[0].bindings).toEqual([
      {
        key: 'ref_0',
        targetNoteId: targetNoteId,
        targetValueId: 'value-replacement-base',
      },
      {
        key: 'ref_1',
        targetNoteId: sourceNoteId,
        targetValueId: sourceValueId,
      },
    ])
  })

  it('keeps durable external bindings for unchanged mixed formulas when the source path no longer resolves', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: sourceNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Source Note',
    })
    const { noteId: targetNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Target Note',
    })

    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignId,
      noteId: sourceNoteId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'mixed-unknown-source-prof-bonus',
          valueId: 'value-prof-bonus',
          slug: 'prof_bonus',
          expressionSource: '2',
        }),
      ],
    })

    const targetBlock = valueBlockWithGeneratedId({
      idSeed: 'mixed-unknown-target-total',
      valueId: 'value-total',
      slug: 'total',
      expressionSource: '[[base]] + [[Source Note.prof_bonus]]',
    })

    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignId,
      noteId: targetNoteId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'mixed-unknown-target-base',
          valueId: 'value-base',
          slug: 'base',
          expressionSource: '3',
        }),
        targetBlock,
      ],
    })

    await renameValueTestNote(dmAuth, {
      campaignId: ctx.campaignId,
      noteId: sourceNoteId,
      name: 'Renamed Source Note',
    })

    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignId,
      noteId: targetNoteId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'mixed-unknown-target-base',
          valueId: 'value-base',
          slug: 'base',
          expressionSource: '3',
        }),
        targetBlock,
      ],
    })

    const states = await dmAuth.query(api.noteValues.queries.getNoteValueStates, {
      campaignId: ctx.campaignId,
      noteId: targetNoteId,
    })

    expect(states.find((state) => state.valueId === 'value-total')).toMatchObject({
      status: 'ok',
      rawValue: 5,
    })

    const rows = await getRowsForValue(ctx, targetNoteId, 'value-total')
    expect(rows[0].bindings).toEqual([
      { key: 'ref_0', targetNoteId, targetValueId: 'value-base' },
      { key: 'ref_1', targetNoteId: sourceNoteId, targetValueId: 'value-prof-bonus' },
    ])
  })

  it('surfaces an explicit missing target error after a referenced value is deleted', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: sourceNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Source Note',
    })
    const { noteId: targetNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Target Note',
    })

    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignId,
      noteId: sourceNoteId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'source-prof-bonus',
          valueId: 'value-prof-bonus',
          slug: 'prof_bonus',
          expressionSource: '2',
        }),
      ],
    })
    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignId,
      noteId: targetNoteId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'target-attack-bonus',
          valueId: 'value-attack-bonus',
          slug: 'attack_bonus',
          expressionSource: '3 + [[Source Note.prof_bonus]]',
        }),
      ],
    })

    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignId,
      noteId: sourceNoteId,
      blocks: [],
    })

    const states = await dmAuth.query(api.noteValues.queries.getNoteValueStates, {
      campaignId: ctx.campaignId,
      noteId: targetNoteId,
    })
    expect(states).toHaveLength(1)
    expect(states[0]).toMatchObject({
      status: 'error',
      rawValue: null,
      errorCode: 'missing_target',
    })
    expect(states[0].formattedValue).toContain('Referenced value could not be found')
  })
})
