import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import {
  createCanvas,
  createFolder,
  createNote,
  createSidebarShare,
} from '../../_test/factories.helper'
import {
  expectNotAuthenticated,
  expectNotFound,
  expectPermissionDenied,
} from '../../_test/assertions.helper'
import { api } from '../../_generated/api'
import { COOLDOWN_MS } from '../functions/claimPreviewGeneration'

describe('claimPreviewGeneration', () => {
  const t = createTestContext()

  it('DM can claim for a note', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignId,
      itemId: noteId,
    })

    expect(result.claimed).toBe(true)
    expect(typeof result.claimToken).toBe('string')

    await t.run(async (dbCtx) => {
      const now = Date.now()
      const note = await dbCtx.db.get('sidebarItems', noteId)
      expect(note!.previewLockedUntil).not.toBeNull()
      expect(note!.previewLockedUntil).toBeGreaterThan(now)
      expect(note!.previewClaimToken).toBe(result.claimToken)
    })
  })

  it('returns false for folders', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignId,
      itemId: folderId,
    })

    expect(result.claimed).toBe(false)
    expect(result.claimToken).toBeNull()
  })

  it('player with edit share can claim', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const result = await playerAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignId,
      itemId: noteId,
    })

    expect(result.claimed).toBe(true)
    expect(typeof result.claimToken).toBe('string')
  })

  it('player with view share is denied', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
        campaignId: ctx.campaignId,
        itemId: noteId,
      }),
    )
  })

  it('player with no share is denied', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
        campaignId: ctx.campaignId,
        itemId: noteId,
      }),
    )
  })

  it('throws NOT_FOUND for nonexistent item', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await t.run(async (dbCtx) => {
      await dbCtx.db.delete('sidebarItems', noteId)
    })

    await expectNotFound(
      dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
        campaignId: ctx.campaignId,
        itemId: noteId,
      }),
    )
  })

  it('returns false when lock is active', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const first = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignId,
      itemId: noteId,
    })
    expect(first.claimed).toBe(true)

    const second = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignId,
      itemId: noteId,
    })
    expect(second.claimed).toBe(false)
    expect(second.claimToken).toBeNull()
  })

  it('returns true when lock has expired', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', noteId, {
        previewLockedUntil: Date.now() - 1,
      })
    })

    const result = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignId,
      itemId: noteId,
    })
    expect(result.claimed).toBe(true)
  })

  it('returns false during cooldown period', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', noteId, {
        previewUpdatedAt: Date.now() - COOLDOWN_MS / 2,
      })
    })

    const result = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignId,
      itemId: noteId,
    })
    expect(result.claimed).toBe(false)
    expect(result.claimToken).toBeNull()
  })

  it('returns true after cooldown expires', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', noteId, {
        previewUpdatedAt: Date.now() - (COOLDOWN_MS + 1),
      })
    })

    const result = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignId,
      itemId: noteId,
    })
    expect(result.claimed).toBe(true)
  })

  it('DM can claim for a canvas', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignId,
      itemId: canvasId,
    })

    expect(result.claimed).toBe(true)
    expect(typeof result.claimToken).toBe('string')

    await t.run(async (dbCtx) => {
      const now = Date.now()
      const canvas = await dbCtx.db.get('sidebarItems', canvasId)
      expect(canvas!.previewLockedUntil).not.toBeNull()
      expect(canvas!.previewLockedUntil).toBeGreaterThan(now)
      expect(canvas!.previewClaimToken).toBe(result.claimToken)
    })
  })

  it('player with edit share can claim canvas', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: canvasId,
      sidebarItemType: 'canvas',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const result = await playerAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignId,
      itemId: canvasId,
    })

    expect(result.claimed).toBe(true)
  })

  it('player with view share is denied for canvas', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: canvasId,
      sidebarItemType: 'canvas',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
        campaignId: ctx.campaignId,
        itemId: canvasId,
      }),
    )
  })

  it('player with no share is denied for canvas', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
        campaignId: ctx.campaignId,
        itemId: canvasId,
      }),
    )
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotAuthenticated(
      t.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
        campaignId: ctx.campaignId,
        itemId: noteId,
      }),
    )
  })
})
