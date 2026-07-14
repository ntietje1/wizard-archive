import * as Y from 'yjs'
import { describe, expect, it, vi } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import {
  copiedRootItemIds,
  createBlockShare,
  createNote,
  createSidebarShare,
  executeCopyCommand,
  getSidebarItemRowId,
} from '../../_test/factories.helper'
import { api, internal } from '../../_generated/api'
import { SHARE_STATUS } from '../../../shared/block-shares/share-status'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { makeYjsUpdateWithBlocks } from '../../_test/yjs.helper'
import {
  hardDeleteValueTestNote,
  replaceNoteDocumentAndPersist,
  valueBlockWithGeneratedId,
} from './helpers.helper'

describe('note value lifecycle', () => {
  const t = createTestContext()

  it('copies note value rows when duplicating a note with inline values', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: sourceId, noteRowId: sourceRowId } = await createNote(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      {
        name: 'Stats',
      },
    )

    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId: sourceId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'copied-strength',
          valueId: 'value-strength',
          slug: 'strength',
          expressionSource: '16',
        }),
      ],
    })
    const sourceRows = await t.run(async (dbCtx) =>
      dbCtx.db
        .query('noteValues')
        .withIndex('by_campaign_note', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('noteId', sourceRowId),
        )
        .collect(),
    )

    const receipt = await executeCopyCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [sourceId],
      targetParentId: null,
    })
    const [copiedId] = copiedRootItemIds(receipt)
    expect(copiedId).toBeDefined()
    const copiedRowId = await getSidebarItemRowId(t, copiedId!)

    const rows = await t.run(async (dbCtx) =>
      dbCtx.db
        .query('noteValues')
        .withIndex('by_campaign_note', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('noteId', copiedRowId),
        )
        .collect(),
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      noteId: copiedRowId,
      slug: 'strength',
      expressionSource: '16',
      compile: { status: 'ok' },
    })
    expect(rows[0].blockNoteId).toBe(sourceRows[0].blockNoteId)
  })

  it('filters persisted value states by note and block visibility', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { noteId, noteRowId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Private Values',
    })

    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'private-strength',
          valueId: 'value-strength',
          slug: 'strength',
          expressionSource: '16',
        }),
      ],
    })

    await expect(
      playerAuth.query(api.noteValues.queries.getNoteValueStates, {
        campaignId: ctx.campaignDomainId,
        noteId,
      }),
    ).resolves.toEqual([])

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: RESOURCE_TYPES.notes,
      campaignMemberId: ctx.player.memberId,
    })

    await expect(
      playerAuth.query(api.noteValues.queries.getNoteValueStates, {
        campaignId: ctx.campaignDomainId,
        noteId,
      }),
    ).resolves.toEqual([])

    const block = await t.run(async (dbCtx) =>
      dbCtx.db
        .query('blocks')
        .withIndex('by_campaign_note_block', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('noteId', noteRowId),
        )
        .first(),
    )
    expect(block).not.toBeNull()
    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('blocks', block!._id, {
        shareStatus: SHARE_STATUS.INDIVIDUALLY_SHARED,
      })
    })
    await createBlockShare(t, {
      campaignId: ctx.campaignId,
      noteId,
      blockId: block!._id,
      campaignMemberId: ctx.player.memberId,
    })

    await expect(
      playerAuth.query(api.noteValues.queries.getNoteValueStates, {
        campaignId: ctx.campaignDomainId,
        noteId,
      }),
    ).resolves.toMatchObject([{ slug: 'strength', status: 'ok', rawValue: 16 }])
  })

  it('removes extracted noteValues rows when an inline value is removed from the note', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId, noteRowId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Lifecycle Remove',
    })

    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'remove-strength',
          valueId: 'value-strength',
          slug: 'strength',
          expressionSource: '15',
        }),
      ],
    })

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('noteValues')
        .withIndex('by_campaign_note', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('noteId', noteRowId),
        )
        .collect()
      expect(rows).toHaveLength(1)
    })

    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId,
      blocks: [],
    })

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('noteValues')
        .withIndex('by_campaign_note', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('noteId', noteRowId),
        )
        .collect()
      expect(rows).toHaveLength(0)
    })
  })

  it('rollback rebuilds noteValues to the restored document state', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { noteId, noteRowId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'Rollback Value Note',
      })

      const originalBlocks = [
        valueBlockWithGeneratedId({
          idSeed: 'rollback-original-strength',
          valueId: 'value-strength',
          slug: 'strength',
          expressionSource: '15',
        }),
      ]
      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        update: makeYjsUpdateWithBlocks(originalBlocks),
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)
      await dmAuth.action(api.notes.actions.persistNoteBlocks, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
      })

      const snapshotEntry = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', noteRowId).eq('action', 'content_edited'),
          )
          .first()
      })
      expect(snapshotEntry).not.toBeNull()
      expect(snapshotEntry!.hasSnapshot).toBe(true)

      vi.advanceTimersByTime(5 * 60 * 1000 + 1)

      const modifiedBlocks = [
        valueBlockWithGeneratedId({
          idSeed: 'rollback-modified-strength',
          valueId: 'value-strength',
          slug: 'strength',
          expressionSource: '18',
        }),
        valueBlockWithGeneratedId({
          idSeed: 'rollback-modified-strength-mod',
          valueId: 'value-strength-mod',
          slug: 'strength_mod',
          expressionSource: 'floor(([[strength]] - 10) / 2)',
        }),
      ]
      await replaceNoteDocumentAndPersist(t, dmAuth, {
        campaignId: ctx.campaignDomainId,
        noteId,
        blocks: modifiedBlocks,
      })

      let states = await dmAuth.query(api.noteValues.queries.getNoteValueStates, {
        campaignId: ctx.campaignDomainId,
        noteId,
      })
      expect(states.map((state) => state.slug).sort()).toEqual(['strength', 'strength_mod'])
      const strength = states.find((state) => state.slug === 'strength')
      expect(strength).toMatchObject({ status: 'ok', rawValue: 18 })

      await dmAuth.action(api.documentSnapshots.actions.rollbackToSnapshot, {
        campaignId: ctx.campaignDomainId,
        editHistoryId: snapshotEntry!.historyEntryUuid,
      })
      await t.action(internal.notes.internalActions.persistNoteBlocksFromYjs, {
        documentId: noteRowId,
      })

      states = await dmAuth.query(api.noteValues.queries.getNoteValueStates, {
        campaignId: ctx.campaignDomainId,
        noteId,
      })
      expect(states).toHaveLength(1)
      expect(states[0]).toMatchObject({
        slug: 'strength',
        status: 'ok',
        rawValue: 15,
      })

      await t.run(async (dbCtx) => {
        const rows = await dbCtx.db
          .query('noteValues')
          .withIndex('by_campaign_note', (q) =>
            q.eq('campaignId', ctx.campaignId).eq('noteId', noteRowId),
          )
          .collect()

        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({
          slug: 'strength',
          expressionSource: '15',
          compile: { status: 'ok' },
        })

        const updates = await dbCtx.db
          .query('yjsUpdates')
          .withIndex('by_document_seq', (q) => q.eq('documentId', noteRowId))
          .collect()
        expect(updates).toHaveLength(1)
        expect(updates[0].isSnapshot).toBe(true)

        const doc = new Y.Doc()
        Y.applyUpdate(doc, new Uint8Array(updates[0].update))
        const fragment = doc.getXmlFragment('document')
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        expect(fragment.toString()).toContain('slug="strength"')
        doc.destroy()
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('hard delete removes noteValues rows for trashed notes', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId, noteRowId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Hard Delete Values',
    })

    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'hard-delete-strength',
          valueId: 'value-strength',
          slug: 'strength',
          expressionSource: '15',
        }),
      ],
    })

    await hardDeleteValueTestNote(dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId,
    })

    await t.run(async (dbCtx) => {
      const note = await dbCtx.db.get('sidebarItems', noteRowId)
      expect(note).toBeNull()

      const rows = await dbCtx.db
        .query('noteValues')
        .withIndex('by_campaign_note', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('noteId', noteRowId),
        )
        .collect()
      expect(rows).toHaveLength(0)
    })
  })

  it('updates downstream external value states only after the source note persists', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: sourceNoteId, noteRowId: sourceNoteRowId } = await createNote(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      { name: 'Lifecycle Source' },
    )
    const { noteId: targetNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Lifecycle Target',
    })

    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId: sourceNoteId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'lifecycle-source-base',
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
          idSeed: 'lifecycle-target-total',
          valueId: 'value-total',
          slug: 'total',
          expressionSource: '[[Lifecycle Source.base]] + 3',
        }),
      ],
    })

    let states = await dmAuth.query(api.noteValues.queries.getNoteValueStates, {
      campaignId: ctx.campaignDomainId,
      noteId: targetNoteId,
    })
    expect(states[0]).toMatchObject({
      status: 'ok',
      rawValue: 5,
    })

    await t.run(async (dbCtx) => {
      const existingUpdates = await dbCtx.db
        .query('yjsUpdates')
        .withIndex('by_document_seq', (q) => q.eq('documentId', sourceNoteRowId))
        .collect()
      for (const row of existingUpdates) {
        await dbCtx.db.delete('yjsUpdates', row._id)
      }
      await dbCtx.db.insert('yjsUpdates', {
        documentId: sourceNoteRowId,
        update: makeYjsUpdateWithBlocks([
          valueBlockWithGeneratedId({
            idSeed: 'lifecycle-source-base',
            valueId: 'value-source-base',
            slug: 'base',
            expressionSource: '5',
          }),
        ]),
        seq: 0,
        isSnapshot: true,
      })
    })

    states = await dmAuth.query(api.noteValues.queries.getNoteValueStates, {
      campaignId: ctx.campaignDomainId,
      noteId: targetNoteId,
    })
    expect(states[0]).toMatchObject({
      status: 'ok',
      rawValue: 5,
    })

    await dmAuth.action(api.notes.actions.persistNoteBlocks, {
      campaignId: ctx.campaignDomainId,
      documentId: sourceNoteId,
    })

    states = await dmAuth.query(api.noteValues.queries.getNoteValueStates, {
      campaignId: ctx.campaignDomainId,
      noteId: targetNoteId,
    })
    expect(states[0]).toMatchObject({
      status: 'ok',
      rawValue: 8,
    })
  })

  it('does not return value states for undo-hidden notes', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId, noteRowId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Undo Hidden Values',
    })

    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId,
      blocks: [
        valueBlockWithGeneratedId({
          idSeed: 'undo-hidden-base',
          valueId: 'value-base',
          slug: 'base',
          expressionSource: '1',
        }),
      ],
    })

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', noteRowId, { status: 'undoHidden' })
    })

    const states = await dmAuth.query(api.noteValues.queries.getNoteValueStates, {
      campaignId: ctx.campaignDomainId,
      noteId,
    })
    expect(states).toEqual([])
  })

  it('repeated persists without content changes remain logically idempotent', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId, noteRowId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Idempotent Persist',
    })

    const blocks = [
      valueBlockWithGeneratedId({
        idSeed: 'idempotent-strength',
        valueId: 'value-strength',
        slug: 'strength',
        expressionSource: '15',
      }),
      valueBlockWithGeneratedId({
        idSeed: 'idempotent-strength-mod',
        valueId: 'value-strength-mod',
        slug: 'strength_mod',
        expressionSource: 'floor(([[strength]] - 10) / 2)',
      }),
    ]

    await replaceNoteDocumentAndPersist(t, dmAuth, {
      campaignId: ctx.campaignDomainId,
      noteId,
      blocks,
    })

    const firstSnapshot = await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('noteValues')
        .withIndex('by_campaign_note', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('noteId', noteRowId),
        )
        .collect()

      return rows
        .map((row) => ({
          blockNoteId: row.blockNoteId,
          valueId: row.valueId,
          slug: row.slug,
          expressionSource: row.expressionSource,
          compile: row.compile,
        }))
        .sort((a, b) => a.blockNoteId.localeCompare(b.blockNoteId))
    })

    await dmAuth.action(api.notes.actions.persistNoteBlocks, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
    })

    const secondSnapshot = await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('noteValues')
        .withIndex('by_campaign_note', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('noteId', noteRowId),
        )
        .collect()

      return rows
        .map((row) => ({
          blockNoteId: row.blockNoteId,
          valueId: row.valueId,
          slug: row.slug,
          expressionSource: row.expressionSource,
          compile: row.compile,
        }))
        .sort((a, b) => a.blockNoteId.localeCompare(b.blockNoteId))
    })

    expect(secondSnapshot).toEqual(firstSnapshot)

    const states = await dmAuth.query(api.noteValues.queries.getNoteValueStates, {
      campaignId: ctx.campaignDomainId,
      noteId,
    })
    const bySlug = new Map(
      states.flatMap((state) =>
        state.status === 'ok' ? ([[state.slug, state.rawValue]] as const) : [],
      ),
    )
    expect(bySlug.get('strength')).toBe(15)
    expect(bySlug.get('strength_mod')).toBe(2)
  })
})
