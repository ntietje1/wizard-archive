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
function getFirstInlineText(block: CustomBlock): string | undefined {
  const content = (block as { content?: Array<{ text?: string }> }).content
  return content?.[0]?.text
}

describe('getFolderContentsForDownload — collectItemsRecursively', () => {
  const t = createTestContext()

  it('empty folder returns empty items array', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Empty',
    })

    const result = await dmAuth.query(api.folders.queries.getFolderContentsForDownload, {
      campaignId: ctx.campaignId,
      folderId,
    })

    expect(result.folderName).toBe('Empty')
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
    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      position: 0,
      content: { id: 'b1', type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
    })

    const result = await dmAuth.query(api.folders.queries.getFolderContentsForDownload, {
      campaignId: ctx.campaignId,
      folderId,
    })

    expect(result.items.length).toBe(1)
    const item = result.items[0]
    expect(item.type).toBe(SIDEBAR_ITEM_TYPES.notes)
    expect(item.name).toBe('Session Log.md')
    expect(item.path).toBe('Session Log.md')
    expect(item.type).toBe(SIDEBAR_ITEM_TYPES.notes)
    if (item.type === SIDEBAR_ITEM_TYPES.notes) {
      expect(item.content.length).toBe(1)
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

    const result = await dmAuth.query(api.folders.queries.getFolderContentsForDownload, {
      campaignId: ctx.campaignId,
      folderId,
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

    const result = await dmAuth.query(api.folders.queries.getFolderContentsForDownload, {
      campaignId: ctx.campaignId,
      folderId,
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

    const result = await dmAuth.query(api.folders.queries.getFolderContentsForDownload, {
      campaignId: ctx.campaignId,
      folderId: parentId,
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

    const result = await dmAuth.query(api.folders.queries.getFolderContentsForDownload, {
      campaignId: ctx.campaignId,
      folderId,
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

    const result = await dmAuth.query(api.folders.queries.getFolderContentsForDownload, {
      campaignId: ctx.campaignId,
      folderId,
    })

    expect(result.items.length).toBe(1)
    expect(result.items[0].name).toBe('readme.md')
    expect(result.items[0].name).not.toBe('readme.md.md')
  })

  it('deep nesting (3+ levels) — paths include all ancestors', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId: l0 } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'L0',
    })
    const { folderId: l1 } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'L1',
      parentId: l0,
    })
    const { folderId: l2 } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'L2',
      parentId: l1,
    })
    await createFile(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: l2,
      name: 'deep.png',
    })

    const result = await dmAuth.query(api.folders.queries.getFolderContentsForDownload, {
      campaignId: ctx.campaignId,
      folderId: l0,
    })

    expect(result.items.length).toBe(1)
    expect(result.items[0].path).toBe('L1/L2/deep.png')
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

    const result = await dmAuth.query(api.folders.queries.getFolderContentsForDownload, {
      campaignId: ctx.campaignId,
      folderId,
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

    // Insert blocks out of order
    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      position: 2,
      content: { id: 'b2', type: 'paragraph', content: [{ type: 'text', text: 'Second' }] },
    })
    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      position: 1,
      content: { id: 'b1', type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
    })

    const result = await dmAuth.query(api.folders.queries.getFolderContentsForDownload, {
      campaignId: ctx.campaignId,
      folderId,
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

    const result = await dmAuth.query(api.folders.queries.getFolderContentsForDownload, {
      campaignId: ctx.campaignId,
      folderId,
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
