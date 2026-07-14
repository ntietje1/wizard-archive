import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createCanvas, createNote } from '../../_test/factories.helper'
import { api } from '../../_generated/api'
import { storeCommittedTestUploadSession } from '../../_test/storage.helper'

describe('enhanceBase previewUrl resolution', () => {
  const t = createTestContext()

  it('returns previewUrl when previewStorageId is set', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId, noteRowId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const { assetId, storageId } = await storeCommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['preview-data']),
      'preview.png',
    )

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', noteRowId, { previewStorageId: storageId })
    })

    const { active: items } = await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignDomainId,
    })

    const note = items.find((i) => i.id === noteId)
    expect(note).toBeDefined()
    expect(note!.previewAssetId).toBe(assetId)
    expect(note!.previewUrl).not.toBeNull()
    expect(typeof note!.previewUrl).toBe('string')
  })

  it('returns previewUrl for canvas when previewStorageId is set', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { canvasId, canvasRowId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    const { assetId, storageId } = await storeCommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['canvas-preview']),
      'canvas-preview.png',
    )

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', canvasRowId, { previewStorageId: storageId })
    })

    const { active: items } = await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignDomainId,
    })

    const canvas = items.find((i) => i.id === canvasId)
    expect(canvas).toBeDefined()
    expect(canvas!.previewAssetId).toBe(assetId)
    expect(canvas!.previewUrl).not.toBeNull()
    expect(typeof canvas!.previewUrl).toBe('string')
  })

  it('returns null previewUrl for canvas when previewStorageId is null', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    const { active: items } = await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignDomainId,
    })

    const canvas = items.find((i) => i.id === canvasId)
    expect(canvas).toBeDefined()
    expect(canvas!.previewUrl).toBeNull()
  })

  it('returns null previewUrl when previewStorageId is null', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const { active: items } = await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignDomainId,
    })

    const note = items.find((i) => i.id === noteId)
    expect(note).toBeDefined()
    expect(note!.previewUrl).toBeNull()
  })
})
