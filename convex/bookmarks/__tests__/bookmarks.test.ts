import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createBookmark, createNote, createSidebarShare } from '../../_test/factories.helper'
import { expectNotFound } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('toggleBookmark', () => {
  const t = createTestContext()

  it('first toggle creates bookmark', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.mutation(api.bookmarks.mutations.toggleBookmark, {
      sidebarItemId: noteId,
    })

    expect(result.isBookmarked).toBe(true)
  })

  it('second toggle soft-deletes bookmark', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.bookmarks.mutations.toggleBookmark, {
      sidebarItemId: noteId,
    })

    const result = await dmAuth.mutation(api.bookmarks.mutations.toggleBookmark, {
      sidebarItemId: noteId,
    })

    expect(result.isBookmarked).toBe(false)
  })

  it('third toggle re-activates bookmark', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.bookmarks.mutations.toggleBookmark, {
      sidebarItemId: noteId,
    })
    await dmAuth.mutation(api.bookmarks.mutations.toggleBookmark, {
      sidebarItemId: noteId,
    })

    const result = await dmAuth.mutation(api.bookmarks.mutations.toggleBookmark, {
      sidebarItemId: noteId,
    })

    expect(result.isBookmarked).toBe(true)
  })

  it('allows player to bookmark DM-owned note without explicit share', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await playerAuth.mutation(api.bookmarks.mutations.toggleBookmark, {
      sidebarItemId: noteId,
    })

    expect(result.isBookmarked).toBe(true)
  })

  it('player with share can toggle bookmark', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const result = await playerAuth.mutation(api.bookmarks.mutations.toggleBookmark, {
      sidebarItemId: noteId,
    })

    expect(result.isBookmarked).toBe(true)
  })

  it('throws NOT_FOUND for nonexistent item', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await t.run(async (dbCtx) => {
      await dbCtx.db.delete('sidebarItems', noteId)
    })

    await expectNotFound(
      dmAuth.mutation(api.bookmarks.mutations.toggleBookmark, {
        sidebarItemId: noteId,
      }),
    )
  })

  it('returns expected shape', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.mutation(api.bookmarks.mutations.toggleBookmark, {
      sidebarItemId: noteId,
    })

    expect(result).toHaveProperty('isBookmarked')
    expect(typeof result.isBookmarked).toBe('boolean')
  })

  it('soft-deleted bookmark is excluded from sidebar item', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createBookmark(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      campaignMemberId: ctx.dm.memberId,
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
    })

    const item = await dmAuth.query(api.sidebarItems.queries.getSidebarItem, {
      id: noteId,
    })
    expect(item.isBookmarked).toBe(false)
  })
})
