import { describe, expect, it } from 'vite-plus/test'
import { createWorkspaceResourceReadModel } from '../../workspace/items'
import { RESOURCE_STATUS } from '../../workspace/items-persistence-contract'
import { createFileSystemClipboard, resolveFileSystemClipboardCommand } from '../command-intents'
import { createFolder, createNote } from '../../test/sidebar-item-factory'
import { testId } from '../../test/id'

describe('filesystem command intents', () => {
  it('stores clipboard selections scoped to a workspace', () => {
    const folder = createFolder({ id: testId<'sidebarItems'>('folder') })
    const child = createNote({
      id: testId<'sidebarItems'>('child'),
      parentId: folder.id,
    })
    const sibling = createNote({
      id: testId<'sidebarItems'>('sibling'),
      parentId: folder.id,
    })

    const clipboard = createFileSystemClipboard(
      'cut',
      [folder.id, child.id, sibling.id],
      testId<'campaigns'>('campaign'),
      createWorkspaceResourceReadModel([folder, child, sibling]),
    )

    expect(clipboard).toEqual({
      mode: 'cut',
      workspaceId: testId<'campaigns'>('campaign'),
      itemIds: [folder.id],
    })
  })

  it('resolves clipboard paste commands against the active surface parent', () => {
    const workspaceId = testId<'campaigns'>('campaign')
    const folder = createFolder({ id: testId<'sidebarItems'>('folder') })
    const note = createNote({ id: testId<'sidebarItems'>('note') })

    const resolved = resolveFileSystemClipboardCommand({
      clipboard: { mode: 'copy', workspaceId, itemIds: [note.id] },
      workspaceId,
      activeItemSurface: { parentId: folder.id },
      readModel: createWorkspaceResourceReadModel([folder, note]),
    })

    expect(resolved).toEqual({
      command: { type: 'copy', itemIds: [note.id], targetParentId: folder.id },
      clearClipboard: false,
    })
  })

  it('resolves paste commands from still-active clipboard roots', () => {
    const workspaceId = testId<'campaigns'>('campaign')
    const folder = createFolder({ id: testId<'sidebarItems'>('folder') })
    const note = createNote({ id: testId<'sidebarItems'>('note') })
    const trashed = createNote({
      id: testId<'sidebarItems'>('trashed'),
      status: RESOURCE_STATUS.trashed,
    })

    const resolved = resolveFileSystemClipboardCommand({
      clipboard: { mode: 'copy', workspaceId, itemIds: [note.id, trashed.id] },
      workspaceId,
      activeItemSurface: { parentId: folder.id },
      readModel: createWorkspaceResourceReadModel([folder, note, trashed]),
    })

    expect(resolved).toEqual({
      command: { type: 'copy', itemIds: [note.id], targetParentId: folder.id },
      clearClipboard: false,
    })
  })

  it('clears clipboard paste state when no clipboard roots remain active', () => {
    const workspaceId = testId<'campaigns'>('campaign')
    const folder = createFolder({ id: testId<'sidebarItems'>('folder') })
    const trashed = createNote({
      id: testId<'sidebarItems'>('trashed'),
      status: RESOURCE_STATUS.trashed,
    })

    const resolved = resolveFileSystemClipboardCommand({
      clipboard: { mode: 'cut', workspaceId, itemIds: [trashed.id] },
      workspaceId,
      activeItemSurface: { parentId: folder.id },
      readModel: createWorkspaceResourceReadModel([folder, trashed]),
    })

    expect(resolved).toEqual({
      command: null,
      clearClipboard: true,
    })
  })
})
