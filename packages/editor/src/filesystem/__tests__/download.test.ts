import { describe, expect, it } from 'vite-plus/test'
import { testCanvasNodeId } from 'shared/test/canvas-node-id'
import type { CanvasDocumentContent } from '../../canvas/document-contract'
import type { FileItemWithContent } from '../../files/item-contract'
import { resolveMapImage } from '../../game-maps/image-resolution'
import type { MapItemWithContent } from '../../game-maps/item-contract'
import type { CanvasItemWithContent } from '../../canvas/item-contract'
import type { NoteItemWithContent } from '../../notes/item-contract'
import { RESOURCE_STATUS, RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import type { AnyItem } from '../../workspace/items'
import { createResourceCatalogModel } from '../catalog'
import { createCatalogFileSystemDownload } from '../download'
import {
  createFile,
  createFolder,
  createGameMap,
  createCanvas,
  createNote,
} from '../../test/sidebar-item-factory'

describe('createCatalogFileSystemDownload', () => {
  it('builds downloadable note, file, and map records from a catalog tree', async () => {
    const folder = createFolder({ name: 'Session' })
    const note = withContent(createNote({ name: 'Log', parentId: folder.id }), {
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }) satisfies NoteItemWithContent
    const file = withContent(createFile({ name: 'Handout', parentId: folder.id }), {
      contentType: 'text/plain',
      downloadUrl: 'source-specific-file-url',
      assetId: null,
    }) satisfies FileItemWithContent
    const map = withContent(createGameMap({ name: 'Docks', parentId: folder.id }), {
      imageAssetId: null,
      imageUrl: 'base-map-url',
      layers: [
        {
          id: 'docks-layer-1',
          imageAssetId: null,
          imageUrl: 'source-specific-map-url',
          name: 'GM Layer',
        },
      ],
      pins: [],
    }) satisfies MapItemWithContent
    const canvasContent = {
      edges: [],
      nodes: [
        {
          id: testCanvasNodeId('canvas-node-1'),
          type: 'text',
          position: { x: 10, y: 20 },
          data: {},
        },
      ],
    } satisfies CanvasDocumentContent
    const canvas = withContent(
      createCanvas({ name: 'Plan', parentId: folder.id }),
      {},
    ) satisfies CanvasItemWithContent
    const { catalog, operationItems } = createResourceCatalogModel({
      activeItems: [folder, note, file, map, canvas],
      trashItems: [],
    })
    const download = createCatalogFileSystemDownload({
      catalog,
      operationItems,
      resolveCanvasDownloadContent: () => canvasContent,
      resolveFileDownloadUrl: (item) => item.downloadUrl,
      resolveMapDownloadUrl: (item) => resolveMapImage(item).imageUrl,
    })

    expect(download.status).toBe('available')
    if (download.status !== 'available') throw new Error('Expected available download source')

    await expect(download.loadRootItemsForDownload()).resolves.toEqual({
      status: 'completed',
      receipt: {
        kind: 'downloadPrepared',
        affectedCount: 4,
      },
      skippedItems: [],
      items: [
        {
          type: RESOURCE_TYPES.notes,
          content: note.content,
          name: 'Log',
          path: 'Session/Log.md',
        },
        {
          type: RESOURCE_TYPES.files,
          downloadUrl: 'source-specific-file-url',
          name: 'Handout',
          path: 'Session/Handout',
        },
        {
          type: RESOURCE_TYPES.gameMaps,
          downloadUrl: 'source-specific-map-url',
          name: 'Docks',
          path: 'Session/Docks',
        },
        {
          type: RESOURCE_TYPES.canvases,
          content: canvasContent,
          name: 'Plan',
          path: 'Session/Plan.canvas.json',
        },
      ],
    })
  })

  it('downloads selected roots without including trashed items', async () => {
    const activeNote = withContent(createNote({ name: 'Active' }), {
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }) satisfies NoteItemWithContent
    const trashedNote = withContent(
      createNote({
        name: 'Trash',
        status: RESOURCE_STATUS.trashed,
      }),
      {
        content: [],
        blockMeta: {},
        blockShareAccessWarnings: [],
      },
    ) satisfies NoteItemWithContent
    const { catalog, operationItems } = createResourceCatalogModel({
      activeItems: [activeNote],
      trashItems: [trashedNote],
    })
    const download = createCatalogFileSystemDownload({
      catalog,
      operationItems,
      resolveCanvasDownloadContent: () => ({ edges: [], nodes: [] }),
      resolveFileDownloadUrl: (item) => item.downloadUrl,
      resolveMapDownloadUrl: (item) => item.imageUrl,
    })

    expect(download.status).toBe('available')
    if (download.status !== 'available') throw new Error('Expected available download source')

    await expect(
      download.loadItemsForDownload({
        itemIds: [activeNote.id, trashedNote.id],
      }),
    ).resolves.toEqual({
      status: 'completed',
      receipt: {
        kind: 'downloadPrepared',
        affectedCount: 1,
      },
      skippedItems: [],
      items: [
        {
          type: RESOURCE_TYPES.notes,
          content: [],
          name: 'Active',
          path: 'Active.md',
        },
      ],
    })
  })

  it('uses selected item projections when loading selected downloads', async () => {
    const catalogMap = withContent(createGameMap({ name: 'Map' }), {
      imageAssetId: null,
      imageUrl: 'catalog-map-url',
      pins: [],
    }) satisfies MapItemWithContent
    const selectedMap = {
      ...catalogMap,
      imageUrl: 'selected-map-url',
    } satisfies MapItemWithContent
    const { catalog, operationItems } = createResourceCatalogModel({
      activeItems: [catalogMap],
      trashItems: [],
    })
    const download = createCatalogFileSystemDownload({
      catalog,
      operationItems,
      resolveCanvasDownloadContent: () => ({ edges: [], nodes: [] }),
      resolveFileDownloadUrl: (item) => item.downloadUrl,
      resolveMapDownloadUrl: (item) => item.imageUrl,
    })

    expect(download.status).toBe('available')
    if (download.status !== 'available') throw new Error('Expected available download source')

    await expect(
      download.loadItemsForDownload({ itemIds: [catalogMap.id], items: [selectedMap] }),
    ).resolves.toMatchObject({
      items: [
        {
          downloadUrl: 'selected-map-url',
          name: 'Map',
          type: RESOURCE_TYPES.gameMaps,
        },
      ],
    })
  })

  it('does not let supplied trashed projections bypass active catalog filtering', async () => {
    const activeNote = withContent(createNote({ name: 'Active' }), {
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }) satisfies NoteItemWithContent
    const suppliedTrashedNote = {
      ...activeNote,
      status: RESOURCE_STATUS.trashed,
    } satisfies NoteItemWithContent
    const { catalog, operationItems } = createResourceCatalogModel({
      activeItems: [activeNote],
      trashItems: [],
    })
    const download = createCatalogFileSystemDownload({
      catalog,
      operationItems,
      resolveCanvasDownloadContent: () => ({ edges: [], nodes: [] }),
      resolveFileDownloadUrl: (item) => item.downloadUrl,
      resolveMapDownloadUrl: (item) => item.imageUrl,
    })

    if (download.status !== 'available') throw new Error('Expected available download source')
    await expect(
      download.loadItemsForDownload({ itemIds: [activeNote.id], items: [suppliedTrashedNote] }),
    ).resolves.toMatchObject({
      status: 'completed',
      items: [expect.objectContaining({ name: 'Active' })],
    })
  })

  it('records unavailable selected items in the export manifest instead of silently dropping them', async () => {
    const missingContentFile = createFile({ name: 'Missing PDF' })
    const { catalog, operationItems } = createResourceCatalogModel({
      activeItems: [missingContentFile],
      trashItems: [],
    })
    const download = createCatalogFileSystemDownload({
      catalog,
      operationItems,
      resolveCanvasDownloadContent: () => ({ edges: [], nodes: [] }),
      resolveFileDownloadUrl: (item) => item.downloadUrl,
      resolveMapDownloadUrl: (item) => item.imageUrl,
    })

    expect(download.status).toBe('available')
    if (download.status !== 'available') throw new Error('Expected available download source')

    await expect(
      download.loadItemsForDownload({ itemIds: [missingContentFile.id] }),
    ).resolves.toEqual({
      status: 'completed',
      receipt: {
        kind: 'downloadPrepared',
        affectedCount: 0,
      },
      items: [],
      skippedItems: [
        {
          itemId: missingContentFile.id,
          type: RESOURCE_TYPES.files,
          name: 'Missing PDF',
          path: 'Missing PDF',
          reason: 'content_unavailable',
        },
      ],
    })
  })

  it('preserves descendant folder structure when downloading a selected folder', async () => {
    const parent = createFolder({ name: 'Parent' })
    const child = createFolder({ name: 'Child', parentId: parent.id })
    const note = withContent(createNote({ name: 'Deep Note', parentId: child.id }), {
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }) satisfies NoteItemWithContent
    const { catalog, operationItems } = createResourceCatalogModel({
      activeItems: [parent, child, note],
      trashItems: [],
    })
    const download = createCatalogFileSystemDownload({
      catalog,
      operationItems,
      resolveCanvasDownloadContent: () => ({ edges: [], nodes: [] }),
      resolveFileDownloadUrl: (item) => item.downloadUrl,
      resolveMapDownloadUrl: (item) => item.imageUrl,
    })

    expect(download.status).toBe('available')
    if (download.status !== 'available') throw new Error('Expected available download source')

    await expect(download.loadItemsForDownload({ itemIds: [parent.id] })).resolves.toEqual({
      status: 'completed',
      receipt: {
        kind: 'downloadPrepared',
        affectedCount: 1,
      },
      skippedItems: [],
      items: [
        {
          type: RESOURCE_TYPES.notes,
          content: [],
          name: 'Deep Note',
          path: 'Child/Deep Note.md',
        },
      ],
    })
  })

  it('dedupes downloadable items against selected folder paths', async () => {
    const folder = createFolder({ name: 'Shared' })
    const folderNote = withContent(createNote({ name: 'Notes', parentId: folder.id }), {
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }) satisfies NoteItemWithContent
    const file = withContent(createFile({ name: 'Shared' }), {
      contentType: 'text/plain',
      downloadUrl: 'shared-file-url',
      assetId: null,
    }) satisfies FileItemWithContent
    const { catalog, operationItems } = createResourceCatalogModel({
      activeItems: [folder, folderNote, file],
      trashItems: [],
    })
    const download = createCatalogFileSystemDownload({
      catalog,
      operationItems,
      resolveCanvasDownloadContent: () => ({ edges: [], nodes: [] }),
      resolveFileDownloadUrl: (item) => item.downloadUrl,
      resolveMapDownloadUrl: (item) => item.imageUrl,
    })

    expect(download.status).toBe('available')
    if (download.status !== 'available') throw new Error('Expected available download source')

    await expect(download.loadItemsForDownload({ itemIds: [folder.id, file.id] })).resolves.toEqual(
      {
        status: 'completed',
        receipt: {
          kind: 'downloadPrepared',
          affectedCount: 2,
        },
        skippedItems: [],
        items: [
          {
            type: RESOURCE_TYPES.notes,
            content: [],
            name: 'Notes',
            path: 'Shared/Notes.md',
          },
          {
            type: RESOURCE_TYPES.files,
            downloadUrl: 'shared-file-url',
            name: 'Shared',
            path: `Shared~${file.id.slice(-8)}`,
          },
        ],
      },
    )
  })

  it('returns an error result when building selected downloads throws', async () => {
    const map = withContent(createGameMap({ name: 'Broken' }), {
      imageAssetId: null,
      imageUrl: 'broken-map',
      pins: [],
    }) satisfies MapItemWithContent
    const { catalog, operationItems } = createResourceCatalogModel({
      activeItems: [map],
      trashItems: [],
    })
    const download = createCatalogFileSystemDownload({
      catalog,
      operationItems,
      resolveCanvasDownloadContent: () => ({ edges: [], nodes: [] }),
      resolveFileDownloadUrl: (item) => item.downloadUrl,
      resolveMapDownloadUrl: () => {
        throw new Error('unexpected map')
      },
    })

    expect(download.status).toBe('available')
    if (download.status !== 'available') throw new Error('Expected available download source')

    await expect(
      download.loadItemsForDownload({
        itemIds: [map.id],
        items: [map],
      }),
    ).resolves.toEqual({ status: 'error', error: expect.any(Error), items: [] })
  })
})

function withContent<T extends AnyItem, C extends object>(
  item: T,
  content: C,
): T &
  C & {
    ancestors: []
  } {
  return {
    ...item,
    ancestors: [],
    ...content,
  }
}
