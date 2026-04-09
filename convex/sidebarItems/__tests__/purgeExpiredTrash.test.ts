import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { setupCampaignContext } from '../../_test/identities.helper'
import { createFolder, createNote } from '../../_test/factories.helper'
import { internal } from '../../_generated/api'

const THIRTY_ONE_DAYS_MS = 31 * 24 * 60 * 60 * 1000
const TWENTY_NINE_DAYS_MS = 29 * 24 * 60 * 60 * 1000

describe('purgeExpiredTrash', () => {
  const t = createTestContext()

  it('hard-deletes items trashed more than 30 days ago', async () => {
    const ctx = await setupCampaignContext(t)
    const expiredTime = Date.now() - THIRTY_ONE_DAYS_MS

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      location: 'trash',
      deletionTime: expiredTime,
      deletedBy: ctx.dm.profile._id,
    })

    await t.mutation(internal.sidebarItems.internalMutations.purgeExpiredTrash, {})

    const result = await t.run(async (dbCtx) => {
      return await dbCtx.db.get(noteId)
    })
    expect(result).toBeNull()
  })

  it('preserves items trashed less than 30 days ago', async () => {
    const ctx = await setupCampaignContext(t)
    const recentTime = Date.now() - TWENTY_NINE_DAYS_MS

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      location: 'trash',
      deletionTime: recentTime,
      deletedBy: ctx.dm.profile._id,
    })

    await t.mutation(internal.sidebarItems.internalMutations.purgeExpiredTrash, {})

    const result = await t.run(async (dbCtx) => {
      return await dbCtx.db.get(noteId)
    })
    expect(result).not.toBeNull()
  })

  it('purges folder and its children when expired', async () => {
    const ctx = await setupCampaignContext(t)
    const expiredTime = Date.now() - THIRTY_ONE_DAYS_MS

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      location: 'trash',
      deletionTime: expiredTime,
      deletedBy: ctx.dm.profile._id,
    })

    const recentTime = Date.now() - TWENTY_NINE_DAYS_MS

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
      location: 'trash',
      deletionTime: recentTime,
      deletedBy: ctx.dm.profile._id,
    })

    await t.mutation(internal.sidebarItems.internalMutations.purgeExpiredTrash, {})

    const { folder: folderResult, note: noteResult } = await t.run(async (dbCtx) => {
      const folder = await dbCtx.db.get(folderId)
      const note = await dbCtx.db.get(noteId)
      return { folder, note }
    })
    expect(folderResult).toBeNull()
    expect(noteResult).toBeNull()
  })

  it('handles mixed expired and recent items', async () => {
    const ctx = await setupCampaignContext(t)
    const expiredTime = Date.now() - THIRTY_ONE_DAYS_MS
    const recentTime = Date.now() - TWENTY_NINE_DAYS_MS

    const { noteId: expiredNote } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      location: 'trash',
      deletionTime: expiredTime,
      deletedBy: ctx.dm.profile._id,
    })

    const { noteId: recentNote } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      location: 'trash',
      deletionTime: recentTime,
      deletedBy: ctx.dm.profile._id,
    })

    await t.mutation(internal.sidebarItems.internalMutations.purgeExpiredTrash, {})

    const { expired, recent } = await t.run(async (dbCtx) => {
      const expiredResult = await dbCtx.db.get(expiredNote)
      const recentResult = await dbCtx.db.get(recentNote)
      return { expired: expiredResult, recent: recentResult }
    })
    expect(expired).toBeNull()
    expect(recent).not.toBeNull()
  })
})
