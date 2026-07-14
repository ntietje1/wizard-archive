import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
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
import { expectPermissionDenied } from '../../_test/assertions.helper'
import { storeCommittedTestUploadSession } from '../../_test/storage.helper'

describe('executeCopyCommand', () => {
  const t = createTestContext()

  async function setupImmutableStorageDuplicate() {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const fileStorageId = (
      await storeCommittedTestUploadSession(
        t,
        ctx.dm.profile._id,
        new Blob(['file-body']),
        'file.txt',
      )
    ).storageId
    const mapStorageId = (
      await storeCommittedTestUploadSession(
        t,
        ctx.dm.profile._id,
        new Blob(['map-body']),
        'map.png',
      )
    ).storageId
    const previewStorageId = (
      await storeCommittedTestUploadSession(
        t,
        ctx.dm.profile._id,
        new Blob(['preview-body']),
        'preview.png',
      )
    ).storageId

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

  it('preserves natural titles when duplicating multiple root items', async () => {
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
    })

    const copiedItems = await t.run(async (dbCtx) => {
      return await Promise.all(
        copiedRootItemIds(result).map((itemId) => dbCtx.db.get('sidebarItems', itemId)),
      )
    })

    expect(copiedItems.map((item) => item?.name)).toEqual(['Scene A', 'Scene B'])
    expect(copiedItems.map((item) => item?.parentId)).toEqual([null, null])
  })

  it('allows duplicate titles in the same parent', async () => {
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

    expect(copied?.name).toBe('Ambush')
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

    expect(rows.copiedFolder?.name).toBe('Encounters')
    expect(rows.copiedNote?.name).toBe('Ambush')
    expect(rows.copiedNote?.parentId).toBe(copiedRootItemIds(result)[0])
    expect(rows.copiedBlocks.map((block) => block.plainText)).toEqual(['Hidden archers'])
    const copiedFromIds = rows.history
      .flatMap((entry) =>
        entry.action === 'copied' && entry.metadata && 'copiedFromItemId' in entry.metadata
          ? [entry.metadata.copiedFromItemId]
          : [],
      )
      .filter((copiedFromItemId) => copiedFromItemId === folderId || copiedFromItemId === noteId)
      .sort((a, b) => String(a).localeCompare(String(b)))
    expect(copiedFromIds).toEqual(
      [folderId, noteId].sort((a, b) => String(a).localeCompare(String(b))),
    )
  })

  it('rejects folder copy when a descendant is inaccessible to the actor', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Shared Folder',
      allPermissionLevel: 'full_access',
    })
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Hidden Note',
      parentId: folderId,
    })
    const { folderId: destinationFolderId } = await createFolder(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      {
        name: 'Destination',
        allPermissionLevel: 'full_access',
      },
    )

    await expectPermissionDenied(
      executeCopyCommand(playerAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [folderId],
        targetParentId: destinationFolderId,
      }),
    )

    const copiedRows = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('sidebarItems')
        .withIndex('by_campaign_status_parent_name_deletionTime', (q) =>
          q
            .eq('campaignId', ctx.campaignId)
            .eq('status', 'active')
            .eq('parentId', destinationFolderId)
            .eq('name', 'Shared Folder'),
        )
        .collect()
    })
    expect(copiedRows).toEqual([])
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
})
