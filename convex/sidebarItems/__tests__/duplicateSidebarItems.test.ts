import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import {
  createFile,
  createFolder,
  createGameMap,
  createNote,
  createBlock,
} from '../../_test/factories.helper'
import { expectValidationFailed } from '../../_test/assertions.helper'
import { SIDEBAR_ITEM_LOCATION } from '../types/baseTypes'
import type { Id } from '../../_generated/dataModel'

describe('duplicateSidebarItems', () => {
  const t = createTestContext()

  it('duplicates multiple root items into the same parent with keep-both decisions', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId: firstId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene A',
    })
    const { noteId: secondId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene B',
    })

    const createdIds = await dmAuth.mutation(api.sidebarItems.mutations.duplicateSidebarItems, {
      campaignId: ctx.campaignId,
      sourceItemIds: [firstId, secondId],
      targetParentId: null,
      decisions: [
        { sourceItemId: firstId, action: 'keepBoth' },
        { sourceItemId: secondId, action: 'keepBoth' },
      ],
    })

    const copiedItems = await t.run(async (dbCtx) => {
      return await Promise.all(
        createdIds.map((itemId) => dbCtx.db.get('sidebarItems', itemId as Id<'sidebarItems'>)),
      )
    })

    expect(copiedItems.map((item) => item?.name)).toEqual(['Scene A 2', 'Scene B 2'])
    expect(copiedItems.map((item) => item?.parentId)).toEqual([null, null])
  })

  it('recursively duplicates folders and writes one copied history entry per duplicate', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Encounters',
    })
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Ambush',
      parentId: folderId,
    })
    await createBlock(t, noteId, ctx.campaignId, { plainText: 'Hidden archers' })

    const createdIds = await dmAuth.mutation(api.sidebarItems.mutations.duplicateSidebarItems, {
      campaignId: ctx.campaignId,
      sourceItemIds: [folderId],
      targetParentId: null,
      decisions: [{ sourceItemId: folderId, action: 'keepBoth' }],
    })

    expect(createdIds).toHaveLength(2)

    const rows = await t.run(async (dbCtx) => {
      const copiedFolder = await dbCtx.db.get('sidebarItems', createdIds[0] as Id<'sidebarItems'>)
      const copiedNote = await dbCtx.db.get('sidebarItems', createdIds[1] as Id<'sidebarItems'>)
      const copiedBlocks = await dbCtx.db
        .query('blocks')
        .withIndex('by_campaign_note_block', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('noteId', createdIds[1] as Id<'sidebarItems'>),
        )
        .collect()
      const history = await dbCtx.db.query('editHistory').collect()
      return { copiedFolder, copiedNote, copiedBlocks, history }
    })

    expect(rows.copiedFolder?.name).toBe('Encounters 2')
    // Nested items keep their names because the copied folder creates a conflict-free parent.
    expect(rows.copiedNote?.name).toBe('Ambush')
    expect(rows.copiedNote?.parentId).toBe(createdIds[0])
    expect(rows.copiedBlocks.map((block) => block.plainText)).toEqual(['Hidden archers'])
    expect(
      rows.history
        .filter((entry) => entry.action === 'copied')
        .map((entry) => entry.metadata?.copiedFromItemId)
        .filter((copiedFromItemId) => copiedFromItemId === folderId || copiedFromItemId === noteId)
        .sort((a, b) => String(a).localeCompare(String(b))),
    ).toEqual([folderId, noteId].sort((a, b) => String(a).localeCompare(String(b))))
  })

  it('replaces a conflicting item by moving the destination to trash before copying', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: sourceId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
    })
    const { folderId: destinationFolderId } = await createFolder(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      { name: 'Destination' },
    )
    const { noteId: destinationId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
      parentId: destinationFolderId,
    })

    await expectValidationFailed(
      dmAuth.mutation(api.sidebarItems.mutations.duplicateSidebarItems, {
        campaignId: ctx.campaignId,
        sourceItemIds: [sourceId],
        targetParentId: destinationFolderId,
      }),
    )

    const createdIds = await dmAuth.mutation(api.sidebarItems.mutations.duplicateSidebarItems, {
      campaignId: ctx.campaignId,
      sourceItemIds: [sourceId],
      targetParentId: destinationFolderId,
      decisions: [{ sourceItemId: sourceId, action: 'replace' }],
    })

    const rows = await t.run(async (dbCtx) => {
      return {
        replaced: await dbCtx.db.get('sidebarItems', destinationId),
        copied: await dbCtx.db.get('sidebarItems', createdIds[0] as Id<'sidebarItems'>),
      }
    })

    expect(rows.replaced?.location).toBe('trash')
    expect(rows.replaced?.deletionTime).toEqual(expect.any(Number))
    expect(rows.copied?.location).toBe('sidebar')
    expect(rows.copied?.parentId).toBe(destinationFolderId)
    expect(rows.copied?.name).toBe('Scene')
  })

  it('shares immutable file, map, and preview storage ids when duplicating', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const [fileStorageId, mapStorageId, previewStorageId] = await t.run(async (dbCtx) => {
      return await Promise.all([
        dbCtx.storage.store(new Blob(['file-body'])),
        dbCtx.storage.store(new Blob(['map-body'])),
        dbCtx.storage.store(new Blob(['preview-body'])),
      ])
    })

    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Handout',
      storageId: fileStorageId,
      previewStorageId,
    })
    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Dungeon',
      imageStorageId: mapStorageId,
    })

    const createdIds = await dmAuth.mutation(api.sidebarItems.mutations.duplicateSidebarItems, {
      campaignId: ctx.campaignId,
      sourceItemIds: [fileId, mapId],
      targetParentId: null,
      decisions: [
        { sourceItemId: fileId, action: 'keepBoth' },
        { sourceItemId: mapId, action: 'keepBoth' },
      ],
    })

    const rows = await t.run(async (dbCtx) => {
      const copiedFile = await dbCtx.db
        .query('files')
        .withIndex('by_sidebarItemId', (q) =>
          q.eq('sidebarItemId', createdIds[0] as Id<'sidebarItems'>),
        )
        .unique()
      const copiedFileItem = await dbCtx.db.get('sidebarItems', createdIds[0] as Id<'sidebarItems'>)
      const copiedMap = await dbCtx.db
        .query('gameMaps')
        .withIndex('by_sidebarItemId', (q) =>
          q.eq('sidebarItemId', createdIds[1] as Id<'sidebarItems'>),
        )
        .unique()
      return { copiedFile, copiedFileItem, copiedMap }
    })

    expect(rows.copiedFile?.storageId).toBe(fileStorageId)
    expect(rows.copiedFileItem?.previewStorageId).toBe(previewStorageId)
    expect(rows.copiedMap?.imageStorageId).toBe(mapStorageId)

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: fileId,
      location: SIDEBAR_ITEM_LOCATION.trash,
    })
    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: mapId,
      location: SIDEBAR_ITEM_LOCATION.trash,
    })
    await dmAuth.mutation(api.sidebarItems.mutations.permanentlyDeleteSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: fileId,
    })
    await dmAuth.mutation(api.sidebarItems.mutations.permanentlyDeleteSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: mapId,
    })

    await t.run(async (dbCtx) => {
      const copiedFileItem = await dbCtx.db.get('sidebarItems', createdIds[0] as Id<'sidebarItems'>)
      const copiedMapItem = await dbCtx.db.get('sidebarItems', createdIds[1] as Id<'sidebarItems'>)
      const copiedFile = await dbCtx.db
        .query('files')
        .withIndex('by_sidebarItemId', (q) =>
          q.eq('sidebarItemId', createdIds[0] as Id<'sidebarItems'>),
        )
        .unique()
      const copiedMap = await dbCtx.db
        .query('gameMaps')
        .withIndex('by_sidebarItemId', (q) =>
          q.eq('sidebarItemId', createdIds[1] as Id<'sidebarItems'>),
        )
        .unique()

      expect(copiedFileItem?.previewStorageId).toBe(previewStorageId)
      expect(copiedFile?.storageId).toBe(fileStorageId)
      expect(copiedMap?.imageStorageId).toBe(mapStorageId)
      expect(copiedMapItem).not.toBeNull()
      await expect(dbCtx.storage.getUrl(fileStorageId)).resolves.not.toBeNull()
      await expect(dbCtx.storage.getUrl(previewStorageId)).resolves.not.toBeNull()
      await expect(dbCtx.storage.getUrl(mapStorageId)).resolves.not.toBeNull()
    })
  })

  it('rejects missing decisions when backend planning finds a duplicate conflict', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Destination',
    })
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
    })
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
      parentId: folderId,
    })

    await expectValidationFailed(
      dmAuth.mutation(api.sidebarItems.mutations.duplicateSidebarItems, {
        campaignId: ctx.campaignId,
        sourceItemIds: [noteId],
        targetParentId: folderId,
      }),
    )
  })
})
