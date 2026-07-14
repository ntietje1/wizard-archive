import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { expectPermissionDenied } from '../../_test/assertions.helper'
import {
  createBlock,
  createCanvas,
  createFile,
  createFolder,
  createGameMap,
  createNote,
} from '../../_test/factories.helper'
import { api } from '../../_generated/api'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { createCanvasDocumentDoc } from '@wizard-archive/editor/canvas/document-contract'
import { uint8ToArrayBuffer } from '../../../shared/yjs-sync/uint8ToArrayBuffer'
import type { DownloadItem } from '../../sidebarItems/functions/downloadTypes'
import type { NoteBlock } from '@wizard-archive/editor/notes/document-contract'

/** Extract the text of the first inline content entry from a block's content */
function hasInlineTextContent(block: unknown): block is { content?: Array<{ text?: string }> } {
  return (
    typeof block === 'object' &&
    block !== null &&
    Array.isArray('content' in block ? block.content : undefined)
  )
}

function getFirstInlineText(block: NoteBlock): string | undefined {
  const unknownBlock: unknown = block
  return hasInlineTextContent(unknownBlock) ? unknownBlock.content?.[0]?.text : undefined
}

describe('getSidebarItemsForDownload — collectItemsRecursively', () => {
  const t = createTestContext()

  it('empty folder returns empty items array', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Empty',
    })

    const result = await dmAuth.query(api.folders.queries.getSidebarItemsForDownload, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [folderId],
    })

    expect(result.items).toEqual([])
  })

  it('folder with one note returns note with .md extension and content', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Notes',
    })
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
      name: 'Session Log',
    })
    await createBlock(t, noteId, ctx.campaignId, {
      position: 0,
      content: [{ type: 'text', text: 'Hello', styles: {} }],
      plainText: 'Hello',
    })

    const result = await dmAuth.query(api.folders.queries.getSidebarItemsForDownload, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [folderId],
    })

    expect(result.items.length).toBe(1)
    const item = result.items[0]
    expect(item.type).toBe(RESOURCE_TYPES.notes)
    expect(item.name).toBe('Session Log.md')
    expect(item.path).toBe('Session Log.md')
    if (item.type === RESOURCE_TYPES.notes) {
      expect(item.content.length).toBe(1)
    }
  })

  it('nested blocks preserve parent-child hierarchy in content', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Nested',
    })
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
      name: 'Nested Note',
    })
    const parent = await createBlock(t, noteId, ctx.campaignId, {
      position: 0,
      content: [{ type: 'text', text: 'Parent', styles: {} }],
      plainText: 'Parent',
    })
    await createBlock(t, noteId, ctx.campaignId, {
      position: 0,
      parentBlockId: parent.blockNoteId,
      depth: 1,
      content: [{ type: 'text', text: 'Child', styles: {} }],
      plainText: 'Child',
    })

    const result = await dmAuth.query(api.folders.queries.getSidebarItemsForDownload, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [folderId],
    })

    expect(result.items.length).toBe(1)
    const item = result.items[0]
    expect(item.type).toBe(RESOURCE_TYPES.notes)
    if (item.type === RESOURCE_TYPES.notes) {
      expect(item.content.length).toBe(1)
      const parentBlock = item.content[0]
      expect(getFirstInlineText(parentBlock)).toBe('Parent')
      expect(parentBlock.children).toBeDefined()
      expect(parentBlock.children!.length).toBe(1)
      expect(getFirstInlineText(parentBlock.children![0] as NoteBlock)).toBe('Child')
    }
  })

  it('folder with one file returns file with name and path', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Files',
    })
    await createFile(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
      name: 'report.pdf',
    })

    const result = await dmAuth.query(api.folders.queries.getSidebarItemsForDownload, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [folderId],
    })

    expect(result.items.length).toBe(1)
    const item = result.items[0]
    expect(item.type).toBe(RESOURCE_TYPES.files)
    expect(item.name).toBe('report.pdf')
    expect(item.path).toBe('report.pdf')
    if (item.type === RESOURCE_TYPES.files) {
      // No storage attached in test — downloadUrl is null
      expect(item.downloadUrl).toBeNull()
    }
  })

  it('folder with one game map returns map with name and path', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Maps',
    })
    await createGameMap(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
      name: 'Dungeon',
    })

    const result = await dmAuth.query(api.folders.queries.getSidebarItemsForDownload, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [folderId],
    })

    expect(result.items.length).toBe(1)
    const item = result.items[0]
    expect(item.type).toBe(RESOURCE_TYPES.gameMaps)
    expect(item.name).toBe('Dungeon')
    expect(item.path).toBe('Dungeon')
  })

  it('nested folders build correct paths (Parent/Child/note.md)', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId: parentId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Parent',
    })
    const { folderId: childId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Child',
      parentId,
    })
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: childId,
      name: 'Deep Note',
    })

    const result = await dmAuth.query(api.folders.queries.getSidebarItemsForDownload, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [parentId],
    })

    expect(result.items.length).toBe(1)
    expect(result.items[0].path).toBe('Child/Deep Note.md')
  })

  it('mixed content — folder with notes, files, and subfolders all collected', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Mixed',
    })
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
      name: 'Note A',
    })
    await createFile(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
      name: 'file.txt',
    })
    await createGameMap(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
      name: 'Map X',
    })
    const { folderId: subId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Sub',
      parentId: folderId,
    })
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: subId,
      name: 'Sub Note',
    })

    const result = await dmAuth.query(api.folders.queries.getSidebarItemsForDownload, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [folderId],
    })

    expect(result.items.length).toBe(4)
    const types = result.items.map((item: DownloadItem) => item.type).sort()
    expect(types).toEqual(
      [
        RESOURCE_TYPES.files,
        RESOURCE_TYPES.gameMaps,
        RESOURCE_TYPES.notes,
        RESOURCE_TYPES.notes,
      ].sort(),
    )
    expect(result.items.find((item: DownloadItem) => item.path === 'Sub/Sub Note.md')).toBeDefined()
  })

  it('note name already ending in .md does not get double extension', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Folder',
    })
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
      name: 'readme.md',
    })

    const result = await dmAuth.query(api.folders.queries.getSidebarItemsForDownload, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [folderId],
    })

    expect(result.items.length).toBe(1)
    expect(result.items[0].name).toBe('readme.md')
  })

  it('deep nesting (3+ levels) — paths include all ancestors', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId: l0 } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Lvl0',
    })
    const { folderId: l1 } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Lvl1',
      parentId: l0,
    })
    const { folderId: l2 } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Lvl2',
      parentId: l1,
    })
    await createFile(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: l2,
      name: 'deep.png',
    })

    const result = await dmAuth.query(api.folders.queries.getSidebarItemsForDownload, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [l0],
    })

    expect(result.items.length).toBe(1)
    expect(result.items[0].path).toBe('Lvl1/Lvl2/deep.png')
  })

  it('downloads canvas documents as JSON artifacts', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'My Canvas',
    })
    const doc = createCanvasDocumentDoc({
      edges: [
        {
          id: 'edge-1',
          source: 'node-1',
          target: 'node-1',
          type: 'bezier',
        },
      ],
      nodes: [
        {
          id: 'node-1',
          type: 'text',
          position: { x: 10, y: 20 },
          data: {},
        },
      ],
    })
    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignDomainId,
      documentId: canvasId,
      update: uint8ToArrayBuffer(Y.encodeStateAsUpdate(doc)),
    })

    const result = await dmAuth.query(api.folders.queries.getSidebarItemsForDownload, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [canvasId],
    })

    expect(result.items).toEqual([
      {
        type: RESOURCE_TYPES.canvases,
        name: 'My Canvas',
        path: 'My Canvas.canvas.json',
        content: {
          edges: [
            {
              id: 'edge-1',
              source: 'node-1',
              target: 'node-1',
              type: 'bezier',
            },
          ],
          nodes: [
            {
              id: 'node-1',
              type: 'text',
              position: { x: 10, y: 20 },
              data: {},
            },
          ],
        },
      },
    ])
  })

  it('block content is ordered by position', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Ordered',
    })
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
      name: 'Ordered Note',
    })

    await createBlock(t, noteId, ctx.campaignId, {
      position: 2,
      content: [{ type: 'text', text: 'Second', styles: {} }],
      plainText: 'Second',
    })
    await createBlock(t, noteId, ctx.campaignId, {
      position: 1,
      content: [{ type: 'text', text: 'First', styles: {} }],
      plainText: 'First',
    })

    const result = await dmAuth.query(api.folders.queries.getSidebarItemsForDownload, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [folderId],
    })

    expect(result.items.length).toBe(1)
    const item = result.items[0]
    expect(item.type).toBe(RESOURCE_TYPES.notes)
    if (item.type === RESOURCE_TYPES.notes) {
      expect(item.content.length).toBe(2)
      const texts = item.content.map((block: NoteBlock) => getFirstInlineText(block))
      expect(texts).toEqual(['First', 'Second'])
    }
  })

  it('nested blocks preserve hierarchy in ordered content', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'OrderedNested',
    })
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
      name: 'Ordered Nested Note',
    })

    const parentBlock = await createBlock(t, noteId, ctx.campaignId, {
      position: 0,
      content: [{ type: 'text', text: 'Parent', styles: {} }],
      plainText: 'Parent',
    })
    await createBlock(t, noteId, ctx.campaignId, {
      position: 0,
      parentBlockId: parentBlock.blockNoteId,
      depth: 1,
      content: [{ type: 'text', text: 'Nested child', styles: {} }],
      plainText: 'Nested child',
    })
    const parentBlock2 = await createBlock(t, noteId, ctx.campaignId, {
      position: 1,
      content: [{ type: 'text', text: 'Parent 2', styles: {} }],
      plainText: 'Parent 2',
    })
    await createBlock(t, noteId, ctx.campaignId, {
      position: 0,
      parentBlockId: parentBlock2.blockNoteId,
      depth: 1,
      content: [{ type: 'text', text: 'Nested child 2', styles: {} }],
      plainText: 'Nested child 2',
    })

    const result = await dmAuth.query(api.folders.queries.getSidebarItemsForDownload, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [folderId],
    })

    expect(result.items.length).toBe(1)
    const item = result.items[0]
    expect(item.type).toBe(RESOURCE_TYPES.notes)
    if (item.type === RESOURCE_TYPES.notes) {
      expect(item.content.length).toBe(2)
      expect(getFirstInlineText(item.content[0])).toBe('Parent')
      expect(getFirstInlineText(item.content[1])).toBe('Parent 2')
      expect(item.content[0].children).toBeDefined()
      expect(item.content[0].children!.length).toBe(1)
      expect(getFirstInlineText(item.content[0].children![0] as NoteBlock)).toBe('Nested child')
      expect(item.content[1].children).toBeDefined()
      expect(item.content[1].children!.length).toBe(1)
      expect(getFirstInlineText(item.content[1].children![0] as NoteBlock)).toBe('Nested child 2')
    }
  })

  it('note with no blocks returns empty content array', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'EmptyNote',
    })
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
      name: 'Blank',
    })

    const result = await dmAuth.query(api.folders.queries.getSidebarItemsForDownload, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [folderId],
    })

    expect(result.items.length).toBe(1)
    expect(result.items[0].type).toBe(RESOURCE_TYPES.notes)
    if (result.items[0].type === RESOURCE_TYPES.notes) {
      expect(result.items[0].content).toEqual([])
    }
  })
})

describe('getRootContentsForDownload — collectItemsRecursively at root', () => {
  const t = createTestContext()

  it('collects mixed root items with correct types', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await createNote(t, ctx.campaignId, ctx.dm.profile._id, { name: 'RootNote' })
    await createFile(t, ctx.campaignId, ctx.dm.profile._id, { name: 'RootFile.pdf' })
    await createGameMap(t, ctx.campaignId, ctx.dm.profile._id, { name: 'RootMap' })

    const result = await dmAuth.query(api.folders.queries.getRootContentsForDownload, {
      campaignId: ctx.campaignDomainId,
    })

    const names = result.items.map((item: DownloadItem) => item.name)
    expect(names).toContain('RootNote.md')
    expect(names).toContain('RootFile.pdf')
    expect(names).toContain('RootMap')
  })

  it('root items have empty-string-free paths (no leading slash)', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await createNote(t, ctx.campaignId, ctx.dm.profile._id, { name: 'PathTest' })

    const result = await dmAuth.query(api.folders.queries.getRootContentsForDownload, {
      campaignId: ctx.campaignDomainId,
    })

    const note = result.items.find((item: DownloadItem) => item.name === 'PathTest.md')
    expect(note).toBeDefined()
    expect(note?.path).toBe('PathTest.md')
    expect(note?.path?.startsWith('/')).toBe(false)
  })

  it('rejects accepted players downloading the root contents', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    await createNote(t, ctx.campaignId, ctx.dm.profile._id, { name: 'RootNote' })

    await expectPermissionDenied(
      playerAuth.query(api.folders.queries.getRootContentsForDownload, {
        campaignId: ctx.campaignDomainId,
      }),
    )
  })
})

describe('getSidebarItemsForDownload', () => {
  const t = createTestContext()

  it('collects one note directly', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Direct Note',
    })
    await createBlock(t, noteId, ctx.campaignId, {
      position: 0,
      content: [{ type: 'text', text: 'Hello', styles: {} }],
      plainText: 'Hello',
    })

    const result = await dmAuth.query(api.folders.queries.getSidebarItemsForDownload, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [noteId],
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0].name).toBe('Direct Note.md')
    expect(result.items[0].path).toBe('Direct Note.md')
  })

  it('collects mixed direct items and folder contents without duplicating descendants', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Folder',
    })
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
      name: 'Nested',
    })
    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Root.pdf',
    })

    const result = await dmAuth.query(api.folders.queries.getSidebarItemsForDownload, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [folderId, noteId, fileId],
    })

    expect(result.items.map((item: DownloadItem) => item.path).sort()).toEqual(
      ['Folder/Nested.md', 'Root.pdf'].sort(),
    )
  })

  it('projects duplicate direct download paths with stable identity suffixes', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId: firstFolderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'First Folder',
    })
    const { folderId: secondFolderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Second Folder',
    })
    const { noteId: firstNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: firstFolderId,
      name: 'Shared Name',
    })
    const { noteId: secondNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: secondFolderId,
      name: 'Shared Name',
    })

    const result = await dmAuth.query(api.folders.queries.getSidebarItemsForDownload, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [firstNoteId, secondNoteId],
    })

    expect(result.items.map((item: DownloadItem) => item.path).sort()).toEqual(
      ['Shared Name.md', `Shared Name~${secondNoteId.slice(-8)}.md`].sort(),
    )
  })
})
