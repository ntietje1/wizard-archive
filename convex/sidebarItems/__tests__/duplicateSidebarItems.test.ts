import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import {
  executeMoveCommand,
  executeCopyCommand,
  executeDeleteForeverCommand,
  copiedRootItemIds,
  createFile,
  createFolder,
  createGameMap,
  createNote,
  createBlock,
  filesystemEventItemIds,
} from '../../_test/factories.helper'
import { expectValidationFailed } from '../../_test/assertions.helper'
import type { Id } from '../../_generated/dataModel'

describe('executeCopyCommand', () => {
  const t = createTestContext()

  async function setupImmutableStorageDuplicate() {
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

    const result = await executeCopyCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [fileId, mapId],
      targetParentId: null,
      decisions: [
        { sourceItemId: fileId, action: 'keepBoth' },
        { sourceItemId: mapId, action: 'keepBoth' },
      ],
    })
    const [copiedFileItemId, copiedMapItemId] = copiedRootItemIds(result)
    if (!copiedFileItemId || !copiedMapItemId) {
      throw new Error('Expected duplicated file and map ids')
    }

    return {
      ctx,
      dmAuth,
      fileId,
      mapId,
      fileStorageId,
      mapStorageId,
      previewStorageId,
      copiedFileItemId,
      copiedMapItemId,
    }
  }

  it('duplicates multiple root items into the same parent with keep-both decisions', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId: firstId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene A',
    })
    const { noteId: secondId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene B',
    })

    const result = await executeCopyCommand(dmAuth, {
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
        copiedRootItemIds(result).map((itemId) => dbCtx.db.get('sidebarItems', itemId)),
      )
    })

    expect(copiedItems.map((item) => item?.name)).toEqual(['Scene A 1', 'Scene B 1'])
    expect(copiedItems.map((item) => item?.parentId)).toEqual([null, null])
  })

  it('auto keeps both when duplicating into the same parent without decisions', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scenes',
    })
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Ambush',
      parentId: folderId,
    })
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Ambush 2',
      parentId: folderId,
    })

    const result = await executeCopyCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [noteId],
      targetParentId: folderId,
    })

    const [copiedId] = copiedRootItemIds(result)
    if (!copiedId) throw new Error('Expected copied item')
    const copied = await t.run(async (dbCtx) => dbCtx.db.get('sidebarItems', copiedId))

    expect(copied?.name).toBe('Ambush 1')
    expect(copied?.parentId).toBe(folderId)
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

    const result = await executeCopyCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [folderId],
      targetParentId: null,
      decisions: [{ sourceItemId: folderId, action: 'keepBoth' }],
    })

    expect(filesystemEventItemIds(result, 'copied')).toHaveLength(1)
    expect(copiedRootItemIds(result)).toHaveLength(1)

    const rows = await t.run(async (dbCtx) => {
      const [copiedFolderId] = filesystemEventItemIds(result, 'copied')
      if (!copiedFolderId) throw new Error('Expected copied folder')
      const copiedFolder = await dbCtx.db.get('sidebarItems', copiedFolderId)
      const copiedNote = await dbCtx.db
        .query('sidebarItems')
        .withIndex('by_campaign_status_parent_name_deletionTime', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('status', 'active').eq('parentId', copiedFolderId),
        )
        .unique()
      if (!copiedNote) throw new Error('Expected copied note')
      const copiedNoteId = copiedNote._id
      const copiedBlocks = await dbCtx.db
        .query('blocks')
        .withIndex('by_campaign_note_block', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('noteId', copiedNoteId),
        )
        .collect()
      const history = await dbCtx.db.query('editHistory').collect()
      return { copiedFolder, copiedNote, copiedBlocks, history }
    })

    expect(rows.copiedFolder?.name).toBe('Encounters 1')
    // Nested items keep their names because the copied folder creates a conflict-free parent.
    expect(rows.copiedNote?.name).toBe('Ambush')
    expect(rows.copiedNote?.parentId).toBe(copiedRootItemIds(result)[0])
    expect(rows.copiedBlocks.map((block) => block.plainText)).toEqual(['Hidden archers'])
    const copiedFromIds = rows.history
      .filter((entry) => entry.action === 'copied')
      .map((entry) => entry.metadata?.copiedFromItemId)
      .filter((copiedFromItemId) => copiedFromItemId === folderId || copiedFromItemId === noteId)
      .sort((a, b) => String(a).localeCompare(String(b)))
    expect(copiedFromIds).toEqual(
      [folderId, noteId].sort((a, b) => String(a).localeCompare(String(b))),
    )
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
      executeCopyCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [sourceId],
        targetParentId: destinationFolderId,
      }),
    )

    const result = await executeCopyCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [sourceId],
      targetParentId: destinationFolderId,
      decisions: [{ sourceItemId: sourceId, action: 'replace' }],
    })

    const rows = await t.run(async (dbCtx) => {
      const [copiedId] = copiedRootItemIds(result)
      if (!copiedId) throw new Error('Expected copied item')
      return {
        replaced: await dbCtx.db.get('sidebarItems', destinationId),
        copied: await dbCtx.db.get('sidebarItems', copiedId),
      }
    })

    expect(rows.replaced?.status).toBe('trashed')
    expect(rows.replaced?.deletionTime).toEqual(expect.any(Number))
    expect(rows.copied?.location).toBe('sidebar')
    expect(rows.copied?.parentId).toBe(destinationFolderId)
    expect(rows.copied?.name).toBe('Scene')
  })

  it('records copy replace receipts as undoable transactions', async () => {
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
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
      parentId: destinationFolderId,
    })

    const receipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
      {
        campaignId: ctx.campaignId,
        command: { type: 'copy', itemIds: [sourceId], targetParentId: destinationFolderId },
        decisions: [{ sourceItemId: sourceId, action: 'replace' }],
      },
    )

    expect(
      receipt.events.filter((event) => event.type === 'replaced').map((event) => event.itemId),
    ).toEqual([sourceId])
    expect(receipt.undoable).toBe(true)
  })

  it('reports skipped and replaced conflicting roots separately', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId: destinationFolderId } = await createFolder(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      { name: 'Destination' },
    )
    const sourceIds: Array<Id<'sidebarItems'>> = []

    for (let index = 1; index <= 9; index += 1) {
      const name = `Scene ${index}`
      const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, { name })
      await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        name,
        parentId: destinationFolderId,
      })
      sourceIds.push(noteId)
    }

    const result = await executeCopyCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: sourceIds,
      targetParentId: destinationFolderId,
      decisions: sourceIds.map((sourceItemId, index) => ({
        sourceItemId,
        action: index === 0 ? ('replace' as const) : ('skip' as const),
      })),
    })

    expect(copiedRootItemIds(result)).toHaveLength(1)
    expect(filesystemEventItemIds(result, 'replaced')).toEqual([sourceIds[0]])
    expect(filesystemEventItemIds(result, 'skipped')).toEqual(sourceIds.slice(1))
  })

  it('propagates folder replace decisions through descendant duplicate conflicts', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId: sourceFolderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scenes',
    })
    const { folderId: targetFolderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Archive',
    })
    const { noteId: sourceChildId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Encounter',
      parentId: sourceFolderId,
    })
    const { folderId: destinationFolderId } = await createFolder(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      {
        name: 'Scenes',
        parentId: targetFolderId,
      },
    )
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Encounter',
      parentId: destinationFolderId,
    })

    const result = await executeCopyCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [sourceFolderId],
      targetParentId: targetFolderId,
      decisions: [{ sourceItemId: sourceFolderId, action: 'replace' }],
    })

    expect(copiedRootItemIds(result)).toEqual([])
    expect(filesystemEventItemIds(result, 'copied')).toHaveLength(0)
    expect(filesystemEventItemIds(result, 'replaced')).toEqual([sourceChildId])
    expect(filesystemEventItemIds(result, 'mergedFolder')).toEqual([sourceFolderId])
  })

  it('records copy folder merge receipts as undoable transactions', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId: sourceFolderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scenes',
    })
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Encounter',
      parentId: sourceFolderId,
    })
    const { folderId: targetFolderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Archive',
    })
    await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scenes',
      parentId: targetFolderId,
    })

    const receipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
      {
        campaignId: ctx.campaignId,
        command: { type: 'copy', itemIds: [sourceFolderId], targetParentId: targetFolderId },
        decisions: [{ sourceItemId: sourceFolderId, action: 'replace' }],
      },
    )

    expect(
      receipt.events.filter((event) => event.type === 'mergedFolder').map((event) => event.itemId),
    ).toEqual([sourceFolderId])
    expect(receipt.undoable).toBe(true)
  })

  it('shares immutable file, map, and preview storage ids when duplicating', async () => {
    const { copiedFileItemId, copiedMapItemId, fileStorageId, mapStorageId, previewStorageId } =
      await setupImmutableStorageDuplicate()

    const rows = await t.run(async (dbCtx) => {
      const copiedFile = await dbCtx.db
        .query('files')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', copiedFileItemId))
        .unique()
      const copiedFileItem = await dbCtx.db.get('sidebarItems', copiedFileItemId)
      const copiedMap = await dbCtx.db
        .query('gameMaps')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', copiedMapItemId))
        .unique()
      return { copiedFile, copiedFileItem, copiedMap }
    })

    expect(rows.copiedFile?.storageId).toBe(fileStorageId)
    expect(rows.copiedFileItem?.previewStorageId).toBe(previewStorageId)
    expect(rows.copiedMap?.imageStorageId).toBe(mapStorageId)
  })

  it('keeps storage accessible after original items are permanently deleted', async () => {
    const {
      ctx,
      dmAuth,
      fileId,
      mapId,
      fileStorageId,
      previewStorageId,
      mapStorageId,
      copiedFileItemId,
      copiedMapItemId,
    } = await setupImmutableStorageDuplicate()

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [fileId, mapId],
      targetParentId: null,
      action: 'trash',
    })
    await executeDeleteForeverCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [fileId, mapId],
    })

    await t.run(async (dbCtx) => {
      const copiedFileItem = await dbCtx.db.get('sidebarItems', copiedFileItemId)
      const copiedMapItem = await dbCtx.db.get('sidebarItems', copiedMapItemId)
      const copiedFile = await dbCtx.db
        .query('files')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', copiedFileItemId))
        .unique()
      const copiedMap = await dbCtx.db
        .query('gameMaps')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', copiedMapItemId))
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
      executeCopyCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [noteId],
        targetParentId: folderId,
      }),
    )
  })
})
