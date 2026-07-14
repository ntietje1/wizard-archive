import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import {
  createCanvas,
  createFile,
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
import {
  PREVIEW_CLAIM_UNAVAILABLE_REASON,
  PREVIEW_GENERATION_COOLDOWN_MS,
} from '../previewGeneration'
import { getPreviewLease } from '../previewLease'

describe('claimPreviewGeneration', () => {
  const t = createTestContext()

  it('DM can claim for a note', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignDomainId,
      itemId: noteId,
    })

    expect(result.status).toBe('claimed')
    if (result.status !== 'claimed') throw new Error('Expected preview claim')

    await t.run(async (dbCtx) => {
      const now = Date.now()
      const note = await dbCtx.db.get('sidebarItems', noteId)
      const lease = await getPreviewLease(dbCtx, noteId)
      expect(note).not.toHaveProperty('previewLockedUntil')
      expect(note).not.toHaveProperty('previewClaimToken')
      expect(lease!.lockedUntil).toBeGreaterThan(now)
      expect(lease!.claimToken).toBe(result.claimToken)
    })
  })

  it('returns false for folders', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignDomainId,
      itemId: folderId,
    })

    expect(result).toEqual({
      status: 'unavailable',
      reason: PREVIEW_CLAIM_UNAVAILABLE_REASON.unsupported,
    })
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
      campaignId: ctx.campaignDomainId,
      itemId: noteId,
    })

    expect(result.status).toBe('claimed')
  })

  it('player with edit share can claim a file preview', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: fileId,
      sidebarItemType: 'file',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const result = await playerAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignDomainId,
      itemId: fileId,
    })

    expect(result.status).toBe('claimed')
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
        campaignId: ctx.campaignDomainId,
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
        campaignId: ctx.campaignDomainId,
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
        campaignId: ctx.campaignDomainId,
        itemId: noteId,
      }),
    )
  })

  it('returns false when lock is active', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const first = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignDomainId,
      itemId: noteId,
    })
    expect(first.status).toBe('claimed')

    const second = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignDomainId,
      itemId: noteId,
    })
    expect(second).toEqual({
      status: 'unavailable',
      reason: PREVIEW_CLAIM_UNAVAILABLE_REASON.generationInProgress,
    })
  })

  it('returns true when lock has expired', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const first = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignDomainId,
      itemId: noteId,
    })
    expect(first.status).toBe('claimed')

    await t.run(async (dbCtx) => {
      const lease = await getPreviewLease(dbCtx, noteId)
      await dbCtx.db.patch('sidebarItemPreviewLeases', lease!._id, { lockedUntil: Date.now() - 1 })
    })

    const result = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignDomainId,
      itemId: noteId,
    })
    expect(result.status).toBe('claimed')
  })

  it('returns false during cooldown period', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      const previewUpdatedAt = Date.now() - PREVIEW_GENERATION_COOLDOWN_MS / 2
      await dbCtx.db.patch('sidebarItems', noteId, {
        previewUpdatedAt,
        updatedTime: previewUpdatedAt - 1,
      })
    })

    const result = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignDomainId,
      itemId: noteId,
    })
    expect(result).toEqual({
      status: 'unavailable',
      reason: PREVIEW_CLAIM_UNAVAILABLE_REASON.current,
    })
  })

  it('allows a fresh claim during cooldown when content changed after the preview', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const now = Date.now()

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', noteId, {
        previewUpdatedAt: now - 1_000,
        updatedTime: now - 500,
      })
    })

    const result = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignDomainId,
      itemId: noteId,
    })

    expect(result.status).toBe('claimed')
  })

  it('supersedes an active claim after the content version changes', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const first = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignDomainId,
      itemId: noteId,
    })
    expect(first.status).toBe('claimed')

    await t.run(async (dbCtx) => {
      const note = await dbCtx.db.get('sidebarItems', noteId)
      await dbCtx.db.patch('sidebarItems', noteId, {
        updatedTime: (note?.updatedTime ?? note?._creationTime ?? Date.now()) + 1,
      })
    })

    const second = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignDomainId,
      itemId: noteId,
    })

    expect(second.status).toBe('claimed')
    if (first.status !== 'claimed' || second.status !== 'claimed') {
      throw new Error('Expected both preview claims')
    }
    expect(second.claimToken).not.toBe(first.claimToken)
  })

  it('returns true after cooldown expires', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', noteId, {
        previewUpdatedAt: Date.now() - (PREVIEW_GENERATION_COOLDOWN_MS + 1),
      })
    })

    const result = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignDomainId,
      itemId: noteId,
    })
    expect(result.status).toBe('claimed')
  })

  it('DM can claim for a canvas', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignDomainId,
      itemId: canvasId,
    })

    expect(result.status).toBe('claimed')
    if (result.status !== 'claimed') throw new Error('Expected preview claim')

    await t.run(async (dbCtx) => {
      const now = Date.now()
      const canvas = await dbCtx.db.get('sidebarItems', canvasId)
      const lease = await getPreviewLease(dbCtx, canvasId)
      expect(canvas).not.toHaveProperty('previewLockedUntil')
      expect(canvas).not.toHaveProperty('previewClaimToken')
      expect(lease!.lockedUntil).toBeGreaterThan(now)
      expect(lease!.claimToken).toBe(result.claimToken)
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
      campaignId: ctx.campaignDomainId,
      itemId: canvasId,
    })

    expect(result.status).toBe('claimed')
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
        campaignId: ctx.campaignDomainId,
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
        campaignId: ctx.campaignDomainId,
        itemId: canvasId,
      }),
    )
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotAuthenticated(
      t.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
        campaignId: ctx.campaignDomainId,
        itemId: noteId,
      }),
    )
  })
})
