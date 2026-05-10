import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import {
  createBlock,
  createCanvas,
  createFile,
  createFolder,
  createGameMap,
  createNote,
} from '../../_test/factories.helper'
import { api } from '../../_generated/api'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { CustomBlock } from '../../notes/editorSpecs'

/** Extract the text of the first inline content entry from a block's content */
function hasInlineTextContent(block: unknown): block is { content?: Array<{ text?: string }> } {
  return (
    typeof block === 'object' &&
    block !== null &&
    Array.isArray('content' in block ? block.content : undefined)
  )
}

function getFirstInlineText(block: CustomBlock): string | undefined {
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
      campaignId: ctx.campaignId,
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
      inlineContent: [{ type: 'text', text: 'Hello', styles: {} }],
      plainText: 'Hello',
    })

    const result = await dmAuth.query(api.folders.queries.getSidebarItemsForDownload, {
      campaignId: ctx.campaignId,
      sourceItemIds: [folderId],
    })

    expect(result.items.length).toBe(1)
    const item = result.items[0]
    expect(item.type).toBe(SIDEBAR_ITEM_TYPES.notes)
    expect(item.name).toBe('Session Log.md')
    expect(item.path).toBe('Session Log.md')
    if (item.type === SIDEBAR_ITEM_TYPES.notes) {
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
      inlineContent: [{ type: 'text', text: 'Parent', styles: {} }],
      plainText: 'Parent',
    })
    await createBlock(t, noteId, ctx.campaignId, {
      position: 0,
      parentBlockId: parent.blockNoteId,
      depth: 1,
      inlineContent: [{ type: 'text', text: 'Child', styles: {} }],
      plainText: 'Child',
    })

    const result = await dmAuth.query(api.folders.queries.getSidebarItemsForDownload, {
      campaignId: ctx.campaignId,
      sourceItemIds: [folderId],
    })

    expect(result.items.length).toBe(1)
    const item = result.items[0]
    expect(item.type).toBe(SIDEBAR_ITEM_TYPES.notes)
    if (item.type === SIDEBAR_ITEM_TYPES.notes) {
      expect(item.content.length).toBe(1)
      const parentBlock = item.content[0]
      expect(getFirstInlineText(parentBlock)).toBe('Parent')
      expect(parentBlock.children).toBeDefined()
      expect(parentBlock.children!.length).toBe(1)
      expect(getFirstInlineText(parentBlock.children![0] as CustomBlock)).toBe('Child')
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
      campaignId: ctx.campaignId,
      sourceItemIds: [folderId],
    })

    expect(result.items.length).toBe(1)
    const item = result.items[0]
    expect(item.type).toBe(SIDEBAR_ITEM_TYPES.files)
    expect(item.name).toBe('report.pdf')
    expect(item.path).toBe('report.pdf')
    if (item.type === SIDEBAR_ITEM_TYPES.files) {
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
      campaignId: ctx.campaignId,
      sourceItemIds: [folderId],
    })

    expect(result.items.length).toBe(1)
    const item = result.items[0]
    expect(item.type).toBe(SIDEBAR_ITEM_TYPES.gameMaps)
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
      campaignId: ctx.campaignId,
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
      campaignId: ctx.campaignId,
      sourceItemIds: [folderId],
    })

    expect(result.items.length).toBe(4)
    const types = result.items.map((i) => i.type).sort()
    expect(types).toEqual(
      [
        SIDEBAR_ITEM_TYPES.files,
        SIDEBAR_ITEM_TYPES.gameMaps,
        SIDEBAR_ITEM_TYPES.notes,
        SIDEBAR_ITEM_TYPES.notes,
      ].sort(),
    )
    expect(result.items.find((i) => i.path === 'Sub/Sub Note.md')).toBeDefined()
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
      campaignId: ctx.campaignId,
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
      campaignId: ctx.campaignId,
      sourceItemIds: [l0],
    })

    expect(result.items.length).toBe(1)
    expect(result.items[0].path).toBe('Lvl1/Lvl2/deep.png')
  })

  it('canvases are skipped — not included in output', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'WithCanvas',
    })
    await createCanvas(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
      name: 'My Canvas',
    })
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
      name: 'Visible Note',
    })

    const result = await dmAuth.query(api.folders.queries.getSidebarItemsForDownload, {
      campaignId: ctx.campaignId,
      sourceItemIds: [folderId],
    })

    expect(result.items.length).toBe(1)
    expect(result.items[0].name).toBe('Visible Note.md')
    expect(result.items.find((i) => i.name === 'My Canvas')).toBeUndefined()
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
      inlineContent: [{ type: 'text', text: 'Second', styles: {} }],
      plainText: 'Second',
    })
    await createBlock(t, noteId, ctx.campaignId, {
      position: 1,
      inlineContent: [{ type: 'text', text: 'First', styles: {} }],
      plainText: 'First',
    })

    const result = await dmAuth.query(api.folders.queries.getSidebarItemsForDownload, {
      campaignId: ctx.campaignId,
      sourceItemIds: [folderId],
    })

    expect(result.items.length).toBe(1)
    const item = result.items[0]
    expect(item.type).toBe(SIDEBAR_ITEM_TYPES.notes)
    if (item.type === SIDEBAR_ITEM_TYPES.notes) {
      expect(item.content.length).toBe(2)
      const texts = item.content.map((c) => getFirstInlineText(c))
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
      inlineContent: [{ type: 'text', text: 'Parent', styles: {} }],
      plainText: 'Parent',
    })
    await createBlock(t, noteId, ctx.campaignId, {
      position: 0,
      parentBlockId: parentBlock.blockNoteId,
      depth: 1,
      inlineContent: [{ type: 'text', text: 'Nested child', styles: {} }],
      plainText: 'Nested child',
    })
    const parentBlock2 = await createBlock(t, noteId, ctx.campaignId, {
      position: 1,
      inlineContent: [{ type: 'text', text: 'Parent 2', styles: {} }],
      plainText: 'Parent 2',
    })
    await createBlock(t, noteId, ctx.campaignId, {
      position: 0,
      parentBlockId: parentBlock2.blockNoteId,
      depth: 1,
      inlineContent: [{ type: 'text', text: 'Nested child 2', styles: {} }],
      plainText: 'Nested child 2',
    })

    const result = await dmAuth.query(api.folders.queries.getSidebarItemsForDownload, {
      campaignId: ctx.campaignId,
      sourceItemIds: [folderId],
    })

    expect(result.items.length).toBe(1)
    const item = result.items[0]
    expect(item.type).toBe(SIDEBAR_ITEM_TYPES.notes)
    if (item.type === SIDEBAR_ITEM_TYPES.notes) {
      expect(item.content.length).toBe(2)
      expect(getFirstInlineText(item.content[0])).toBe('Parent')
      expect(getFirstInlineText(item.content[1])).toBe('Parent 2')
      expect(item.content[0].children).toBeDefined()
      expect(item.content[0].children!.length).toBe(1)
      expect(getFirstInlineText(item.content[0].children![0] as CustomBlock)).toBe('Nested child')
      expect(item.content[1].children).toBeDefined()
      expect(item.content[1].children!.length).toBe(1)
      expect(getFirstInlineText(item.content[1].children![0] as CustomBlock)).toBe('Nested child 2')
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
      campaignId: ctx.campaignId,
      sourceItemIds: [folderId],
    })

    expect(result.items.length).toBe(1)
    expect(result.items[0].type).toBe(SIDEBAR_ITEM_TYPES.notes)
    if (result.items[0].type === SIDEBAR_ITEM_TYPES.notes) {
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
      campaignId: ctx.campaignId,
    })

    const names = result.items.map((i) => i.name)
    expect(names).toContain('RootNote.md')
    expect(names).toContain('RootFile.pdf')
    expect(names).toContain('RootMap')
  })

  it('root items have empty-string-free paths (no leading slash)', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await createNote(t, ctx.campaignId, ctx.dm.profile._id, { name: 'PathTest' })

    const result = await dmAuth.query(api.folders.queries.getRootContentsForDownload, {
      campaignId: ctx.campaignId,
    })

    const note = result.items.find((i) => i.name === 'PathTest.md')
    expect(note).toBeDefined()
    expect(note?.path).toBe('PathTest.md')
    expect(note?.path?.startsWith('/')).toBe(false)
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
      inlineContent: [{ type: 'text', text: 'Hello', styles: {} }],
      plainText: 'Hello',
    })

    const result = await dmAuth.query(api.folders.queries.getSidebarItemsForDownload, {
      campaignId: ctx.campaignId,
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
      campaignId: ctx.campaignId,
      sourceItemIds: [folderId, noteId, fileId],
    })

    expect(result.items.map((item) => item.path).sort()).toEqual(
      ['Folder/Nested.md', 'Root.pdf'].sort(),
    )
  })

  it('deduplicates same-named direct download paths like keep-both naming', async () => {
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
      campaignId: ctx.campaignId,
      sourceItemIds: [firstNoteId, secondNoteId],
    })

    expect(result.items.map((item) => item.path).sort()).toEqual(
      ['Shared Name.md', 'Shared Name 2.md'].sort(),
    )
  })
})
