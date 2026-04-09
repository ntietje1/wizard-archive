import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createNote } from '../../_test/factories.helper'
import { api } from '../../_generated/api'
import { shouldCompact } from '../functions/compactUpdates'
import { uint8ToArrayBuffer } from '../functions/uint8ToArrayBuffer'
import { createYjsDocument } from '../functions/createYjsDocument'
import { deleteYjsDocument } from '../functions/deleteYjsDocument'
import { makeYjsUpdate } from './makeYjsUpdate.helper'

describe('shouldCompact', () => {
  it('returns false for seq 0', () => {
    expect(shouldCompact(0)).toBe(false)
  })

  it('returns true for seq 20', () => {
    expect(shouldCompact(20)).toBe(true)
  })

  it('returns true for seq 40', () => {
    expect(shouldCompact(40)).toBe(true)
  })

  it('returns false for seq 19', () => {
    expect(shouldCompact(19)).toBe(false)
  })

  it('returns false for seq 1', () => {
    expect(shouldCompact(1)).toBe(false)
  })
})

describe('uint8ToArrayBuffer', () => {
  it('converts Uint8Array to ArrayBuffer correctly', () => {
    const input = new Uint8Array([1, 2, 3])
    const result = uint8ToArrayBuffer(input)

    expect(result).toBeInstanceOf(ArrayBuffer)
    const view = new Uint8Array(result)
    expect(view[0]).toBe(1)
    expect(view[1]).toBe(2)
    expect(view[2]).toBe(3)
    expect(view.length).toBe(3)
  })

  it('handles Uint8Array with byte offset', () => {
    const buffer = new ArrayBuffer(8)
    const full = new Uint8Array(buffer)
    full.set([10, 20, 30, 40, 50, 60, 70, 80])

    const subarray = full.subarray(2, 5)
    const result = uint8ToArrayBuffer(subarray)

    const view = new Uint8Array(result)
    expect(view.length).toBe(3)
    expect(view[0]).toBe(30)
    expect(view[1]).toBe(40)
    expect(view[2]).toBe(50)
  })
})

describe('createYjsDocument', () => {
  const t = createTestContext()

  it('creates initial yjsUpdates row with seq 0 and isSnapshot true', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Test Note',
      parentId: null,
    })

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('yjsUpdates')
        .withIndex('by_document_seq', (q) => q.eq('documentId', result.noteId).eq('seq', 0))
        .collect()
      expect(rows).toHaveLength(1)
      expect(rows[0].isSnapshot).toBe(true)
      expect(rows[0].seq).toBe(0)
    })
  })

  it('does not create duplicate if called twice', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      await createYjsDocument(dbCtx, { documentId: noteId })
    })

    await t.run(async (dbCtx) => {
      await createYjsDocument(dbCtx, { documentId: noteId })
    })

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('yjsUpdates')
        .withIndex('by_document_seq', (q) => q.eq('documentId', noteId).eq('seq', 0))
        .collect()
      expect(rows).toHaveLength(1)
    })
  })
})

describe('deleteYjsDocument', () => {
  const t = createTestContext()

  it('deletes all yjsUpdates and yjsAwareness for a document', async () => {
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
      await dbCtx.db.insert('yjsUpdates', {
        documentId: noteId,
        update,
        seq: 1,
        isSnapshot: false,
      })
      await dbCtx.db.insert('yjsAwareness', {
        documentId: noteId,
        clientId: 1,
        userId: ctx.dm.profile._id,
        state: new ArrayBuffer(4),
        updatedAt: Date.now(),
      })
    })

    await t.run(async (dbCtx) => {
      await deleteYjsDocument(dbCtx, noteId)
    })

    await t.run(async (dbCtx) => {
      const updates = await dbCtx.db
        .query('yjsUpdates')
        .withIndex('by_document_seq', (q) => q.eq('documentId', noteId))
        .collect()
      const awareness = await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document', (q) => q.eq('documentId', noteId))
        .collect()
      expect(updates).toHaveLength(0)
      expect(awareness).toHaveLength(0)
    })
  })

  it('does not affect other documents rows', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId: noteA } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId: noteB } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const update = makeYjsUpdate()

    await t.run(async (dbCtx) => {
      await dbCtx.db.insert('yjsUpdates', {
        documentId: noteA,
        update,
        seq: 0,
        isSnapshot: true,
      })
      await dbCtx.db.insert('yjsUpdates', {
        documentId: noteB,
        update,
        seq: 0,
        isSnapshot: true,
      })
      await dbCtx.db.insert('yjsAwareness', {
        documentId: noteA,
        clientId: 1,
        userId: ctx.dm.profile._id,
        state: new ArrayBuffer(4),
        updatedAt: Date.now(),
      })
      await dbCtx.db.insert('yjsAwareness', {
        documentId: noteB,
        clientId: 2,
        userId: ctx.dm.profile._id,
        state: new ArrayBuffer(4),
        updatedAt: Date.now(),
      })
    })

    await t.run(async (dbCtx) => {
      await deleteYjsDocument(dbCtx, noteA)
    })

    await t.run(async (dbCtx) => {
      const updatesA = await dbCtx.db
        .query('yjsUpdates')
        .withIndex('by_document_seq', (q) => q.eq('documentId', noteA))
        .collect()
      const updatesB = await dbCtx.db
        .query('yjsUpdates')
        .withIndex('by_document_seq', (q) => q.eq('documentId', noteB))
        .collect()
      const awarenessA = await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document', (q) => q.eq('documentId', noteA))
        .collect()
      const awarenessB = await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document', (q) => q.eq('documentId', noteB))
        .collect()
      expect(updatesA).toHaveLength(0)
      expect(updatesB).toHaveLength(1)
      expect(awarenessA).toHaveLength(0)
      expect(awarenessB).toHaveLength(1)
    })
  })
})
