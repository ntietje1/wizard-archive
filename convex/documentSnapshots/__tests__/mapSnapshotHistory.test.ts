import { executeTestFileSystemCommand } from '../../_test/filesystemCommand.helper'
import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { createGameMapViaFilesystem } from '../../_test/filesystemSetup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { storeCommittedTestUploadSession } from '../../_test/storage.helper'
import { getSidebarItemRowId } from '../../_test/factories.helper'
import { api } from '../../_generated/api'

describe('updateMap creates correct number of history entries', () => {
  const t = createTestContext()

  it('changing only the image should create exactly 1 history entry', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { sessionId } = await storeCommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['test'], { type: 'image/png' }),
      'map.png',
    )

    const result = await createGameMapViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Single Entry Map',
      parentTarget: { kind: 'direct', parentId: null },
      uploadSessionId: sessionId,
    })
    const mapRowId = await getSidebarItemRowId(t, result.mapId)

    // Count history entries before
    const beforeCount = await t.run(async (dbCtx) => {
      const entries = await dbCtx.db
        .query('editHistory')
        .withIndex('by_item', (q) => q.eq('itemId', mapRowId))
        .collect()
      return entries.length
    })

    // Change image to null (remove)
    await dmAuth.mutation(api.gameMaps.mutations.updateMapImage, {
      campaignId: ctx.campaignDomainId,
      mapId: result.mapId,
      replacementToken: null,
      uploadSessionId: null,
    })

    const afterEntries = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('editHistory')
        .withIndex('by_item', (q) => q.eq('itemId', mapRowId))
        .collect()
    })

    const newEntries = afterEntries.length - beforeCount
    // Should create exactly 1 history entry (map_image_removed)
    expect(newEntries).toBe(1)

    const imageEntry = afterEntries.find((e) => e.action === 'map_image_removed')
    expect(imageEntry).toBeDefined()
  })

  it('records filesystem rename and map image updates as separate history entries', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { sessionId } = await storeCommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['test'], { type: 'image/png' }),
      'map.png',
    )

    const result = await createGameMapViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Multi Update Map',
      parentTarget: { kind: 'direct', parentId: null },
      uploadSessionId: sessionId,
    })
    const mapRowId = await getSidebarItemRowId(t, result.mapId)

    const beforeCount = await t.run(async (dbCtx) => {
      const entries = await dbCtx.db
        .query('editHistory')
        .withIndex('by_item', (q) => q.eq('itemId', mapRowId))
        .collect()
      return entries.length
    })

    await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: {
        type: 'rename',
        itemId: result.mapId,
        name: 'Renamed Map',
      },
    })

    await dmAuth.mutation(api.gameMaps.mutations.updateMapImage, {
      campaignId: ctx.campaignDomainId,
      mapId: result.mapId,
      replacementToken: null,
      uploadSessionId: null,
    })

    const afterEntries = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('editHistory')
        .withIndex('by_item', (q) => q.eq('itemId', mapRowId))
        .collect()
    })

    const newEntries = afterEntries.length - beforeCount
    expect(newEntries).toBe(2)

    const newEntriesList = afterEntries.slice(beforeCount)
    expect(newEntriesList.map((entry) => entry.action).sort()).toEqual([
      'map_image_removed',
      'renamed',
    ])
  })
})
