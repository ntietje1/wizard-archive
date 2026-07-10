import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createCanvas, createNote } from '../../_test/factories.helper'
import { api } from '../../_generated/api'

describe('enhanceBase previewUrl resolution', () => {
  const t = createTestContext()

  it('returns previewUrl when previewStorageId is set', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const storageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['preview-data']))
    })

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', noteId, { previewStorageId: storageId })
    })

    const { active: items } = await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignId,
    })

    const note = items.find((i) => i.id === noteId)
    expect(note).toBeDefined()
    expect(note!.previewUrl).not.toBeNull()
    expect(typeof note!.previewUrl).toBe('string')
  })

  it('returns previewUrl for canvas when previewStorageId is set', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    const storageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['canvas-preview']))
    })

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', canvasId, { previewStorageId: storageId })
    })

    const { active: items } = await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignId,
    })

    const canvas = items.find((i) => i.id === canvasId)
    expect(canvas).toBeDefined()
    expect(canvas!.previewUrl).not.toBeNull()
    expect(typeof canvas!.previewUrl).toBe('string')
  })

  it('returns null previewUrl for canvas when previewStorageId is null', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    const { active: items } = await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignId,
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
      campaignId: ctx.campaignId,
    })

    const note = items.find((i) => i.id === noteId)
    expect(note).toBeDefined()
    expect(note!.previewUrl).toBeNull()
  })
})
