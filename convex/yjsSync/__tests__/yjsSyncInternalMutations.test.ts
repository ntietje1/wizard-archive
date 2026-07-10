import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { createTestContext } from '../../_test/setup.helper'
import { setupCampaignContext } from '../../_test/identities.helper'
import { createNote } from '../../_test/factories.helper'
import { internal } from '../../_generated/api'
import { AWARENESS_TTL_MS } from '../../../shared/yjs-sync/awareness'
import { makeYjsUpdate } from '../../_test/yjs.helper'

afterEach(() => vi.useRealTimers())

describe('compact', () => {
  const t = createTestContext()

  it('merges multiple updates into single snapshot', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const update = makeYjsUpdate()

    for (let i = 0; i < 5; i++) {
      await t.run(async (dbCtx) => {
        await dbCtx.db.insert('yjsUpdates', {
          documentId: noteId,
          update,
          seq: i,
          isSnapshot: i === 0,
        })
      })
    }

    await t.action(internal.yjsSync.internalActions.compact, {
      documentId: noteId,
    })

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('yjsUpdates')
        .withIndex('by_document_seq', (q) => q.eq('documentId', noteId))
        .collect()
      expect(rows).toHaveLength(1)
      expect(rows[0].isSnapshot).toBe(true)
    })
  })

  it('preserves max seq value', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const update = makeYjsUpdate()

    for (let i = 0; i < 4; i++) {
      await t.run(async (dbCtx) => {
        await dbCtx.db.insert('yjsUpdates', {
          documentId: noteId,
          update,
          seq: i,
          isSnapshot: i === 0,
        })
      })
    }

    await t.action(internal.yjsSync.internalActions.compact, {
      documentId: noteId,
    })

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('yjsUpdates')
        .withIndex('by_document_seq', (q) => q.eq('documentId', noteId))
        .collect()
      expect(rows).toHaveLength(1)
      expect(rows[0].seq).toBe(3)
    })
  })

  it('no-op when only one update exists', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const update = makeYjsUpdate()

    await t.run(async (dbCtx) => {
      await dbCtx.db.insert('yjsUpdates', {
        documentId: noteId,
        update,
        seq: 0,
        isSnapshot: true,
      })
    })

    await t.action(internal.yjsSync.internalActions.compact, {
      documentId: noteId,
    })

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('yjsUpdates')
        .withIndex('by_document_seq', (q) => q.eq('documentId', noteId))
        .collect()
      expect(rows).toHaveLength(1)
      expect(rows[0].seq).toBe(0)
    })
  })

  it('resulting snapshot produces same YDoc state', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const originalDoc = new Y.Doc()
    const fragment = originalDoc.getXmlFragment('document')
    const initialUpdate = Y.encodeStateAsUpdate(originalDoc)
    const initialAb = initialUpdate.buffer.slice(
      initialUpdate.byteOffset,
      initialUpdate.byteOffset + initialUpdate.byteLength,
    ) as ArrayBuffer

    const preModStateVector = Y.encodeStateVector(originalDoc)
    fragment.insert(0, [new Y.XmlText('hello world')])
    const modUpdate = Y.encodeStateAsUpdate(originalDoc, preModStateVector)
    const modAb = modUpdate.buffer.slice(
      modUpdate.byteOffset,
      modUpdate.byteOffset + modUpdate.byteLength,
    ) as ArrayBuffer

    const originalStateVector = Y.encodeStateVector(originalDoc)
    originalDoc.destroy()

    await t.run(async (dbCtx) => {
      await dbCtx.db.insert('yjsUpdates', {
        documentId: noteId,
        update: initialAb,
        seq: 0,
        isSnapshot: true,
      })
    })

    await t.run(async (dbCtx) => {
      await dbCtx.db.insert('yjsUpdates', {
        documentId: noteId,
        update: modAb,
        seq: 1,
        isSnapshot: false,
      })
    })

    await t.action(internal.yjsSync.internalActions.compact, {
      documentId: noteId,
    })

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('yjsUpdates')
        .withIndex('by_document_seq', (q) => q.eq('documentId', noteId))
        .collect()
      expect(rows).toHaveLength(1)

      const reconstructed = new Y.Doc()
      Y.applyUpdate(reconstructed, new Uint8Array(rows[0].update))
      const reconstructedStateVector = Y.encodeStateVector(reconstructed)
      reconstructed.destroy()

      expect(reconstructedStateVector).toEqual(originalStateVector)
    })
  })
})

describe('cleanupStaleAwareness', () => {
  const t = createTestContext()

  it('removes entries older than AWARENESS_TTL_MS', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      await dbCtx.db.insert('yjsAwareness', {
        documentId: noteId,
        clientId: 1,
        userId: ctx.dm.profile._id,
        sessionId: 'stale-session',
        state: new ArrayBuffer(4),
        updatedAt: Date.now() - (AWARENESS_TTL_MS + 1000),
      })
    })

    await t.mutation(internal.yjsSync.internalMutations.cleanupStaleAwareness, {})

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document', (q) => q.eq('documentId', noteId))
        .collect()
      expect(rows).toHaveLength(0)
    })
  })

  it('preserves recent entries', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      await dbCtx.db.insert('yjsAwareness', {
        documentId: noteId,
        clientId: 1,
        userId: ctx.dm.profile._id,
        sessionId: 'recent-session',
        state: new ArrayBuffer(4),
        updatedAt: Date.now() - Math.floor(AWARENESS_TTL_MS / 2),
      })
    })

    await t.mutation(internal.yjsSync.internalMutations.cleanupStaleAwareness, {})

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document', (q) => q.eq('documentId', noteId))
        .collect()
      expect(rows).toHaveLength(1)
    })
  })

  it('handles mix of stale and fresh entries', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      await dbCtx.db.insert('yjsAwareness', {
        documentId: noteId,
        clientId: 1,
        userId: ctx.dm.profile._id,
        sessionId: 'stale-session',
        state: new ArrayBuffer(4),
        updatedAt: Date.now() - (AWARENESS_TTL_MS + 1000),
      })
    })

    await t.run(async (dbCtx) => {
      await dbCtx.db.insert('yjsAwareness', {
        documentId: noteId,
        clientId: 2,
        userId: ctx.dm.profile._id,
        sessionId: 'fresh-session',
        state: new ArrayBuffer(4),
        updatedAt: Date.now() - Math.floor(AWARENESS_TTL_MS / 2),
      })
    })

    await t.mutation(internal.yjsSync.internalMutations.cleanupStaleAwareness, {})

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document', (q) => q.eq('documentId', noteId))
        .collect()
      expect(rows).toHaveLength(1)
      expect(rows[0].clientId).toBe(2)
    })
  })

  it('no-op when no awareness entries exist', async () => {
    // Should complete without throwing
    await expect(
      t.mutation(internal.yjsSync.internalMutations.cleanupStaleAwareness, {}),
    ).resolves.not.toThrow()
  })

  it('deletes at most one fixed batch and schedules the remainder', async () => {
    vi.useFakeTimers()
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      for (let clientId = 0; clientId < 125; clientId += 1) {
        await dbCtx.db.insert('yjsAwareness', {
          documentId: noteId,
          clientId,
          userId: ctx.dm.profile._id,
          sessionId: `stale-session-${clientId}`,
          state: new ArrayBuffer(4),
          updatedAt: Date.now() - (AWARENESS_TTL_MS + 1000),
        })
      }
    })

    await expect(
      t.mutation(internal.yjsSync.internalMutations.cleanupStaleAwareness, {}),
    ).resolves.toEqual({ deletedCount: 100, hasMore: true })
    await t.run(async (dbCtx) => {
      expect(
        await dbCtx.db
          .query('yjsAwareness')
          .withIndex('by_document', (q) => q.eq('documentId', noteId))
          .collect(),
      ).toHaveLength(25)
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    await t.run(async (dbCtx) => {
      expect(
        await dbCtx.db
          .query('yjsAwareness')
          .withIndex('by_document', (q) => q.eq('documentId', noteId))
          .collect(),
      ).toHaveLength(0)
    })
  })
})
