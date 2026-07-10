import { describe, expect, it, vi } from 'vite-plus/test'
import { createFolder, createNote } from '../../../test/sidebar-item-factory'
import { testId } from '../../../test/id'
import { createTestWorkspaceRuntime } from '../../../test/workspace-runtime-factory'
import { createWorkspaceFilesystemContextMenuTarget } from '../filesystem-target'
import type { FileSystemItemContextMenuOperations } from '../../../filesystem/item-operation-contracts'

describe('createWorkspaceFilesystemContextMenuTarget', () => {
  it('routes context-menu duplicate through the filesystem resource command model', async () => {
    const folder = createFolder({ id: testId<'sidebarItems'>('folder_1'), name: 'Scenes' })
    const first = createNote({
      id: testId<'sidebarItems'>('note_1'),
      parentId: folder.id,
    })
    const second = createNote({
      id: testId<'sidebarItems'>('note_2'),
      parentId: folder.id,
    })
    const executeDropCommand =
      operationMock<FileSystemItemContextMenuOperations['executeDropCommand']>()
    const runtime = createTestWorkspaceRuntime({
      activeItems: [folder, first, second],
      operations: { executeDropCommand },
    })
    const target = createWorkspaceFilesystemContextMenuTarget(runtime.filesystem)

    await target.duplicateItems([first, second])

    expect(executeDropCommand).toHaveBeenCalledExactlyOnceWith({
      type: 'copy',
      itemIds: [first.id, second.id],
      targetParentId: folder.id,
    })
  })

  it('duplicates mixed-parent selections in each item group original parent', async () => {
    const firstFolder = createFolder({
      id: testId<'sidebarItems'>('folder_1'),
      name: 'Scenes',
    })
    const secondFolder = createFolder({
      id: testId<'sidebarItems'>('folder_2'),
      name: 'NPCs',
    })
    const first = createNote({
      id: testId<'sidebarItems'>('note_1'),
      parentId: firstFolder.id,
    })
    const second = createNote({
      id: testId<'sidebarItems'>('note_2'),
      parentId: secondFolder.id,
    })
    const root = createNote({ id: testId<'sidebarItems'>('note_root'), parentId: null })
    const executeDropCommand =
      operationMock<FileSystemItemContextMenuOperations['executeDropCommand']>()
    const runtime = createTestWorkspaceRuntime({
      activeItems: [firstFolder, secondFolder, first, second, root],
      canCreateItems: true,
      operations: { executeDropCommand },
    })
    const target = createWorkspaceFilesystemContextMenuTarget(runtime.filesystem)

    await target.duplicateItems([first, second, root])

    expect(executeDropCommand).toHaveBeenNthCalledWith(1, {
      type: 'copy',
      itemIds: [first.id],
      targetParentId: firstFolder.id,
    })
    expect(executeDropCommand).toHaveBeenNthCalledWith(2, {
      type: 'copy',
      itemIds: [second.id],
      targetParentId: secondFolder.id,
    })
    expect(executeDropCommand).toHaveBeenNthCalledWith(3, {
      type: 'copy',
      itemIds: [root.id],
      targetParentId: null,
    })
  })

  it('hides duplicate for root items when root creation is unavailable', () => {
    const root = createNote({ id: testId<'sidebarItems'>('note_root'), parentId: null })
    const runtime = createTestWorkspaceRuntime({
      activeItems: [root],
      canCreateItems: false,
    })
    const target = createWorkspaceFilesystemContextMenuTarget(runtime.filesystem)

    expect(target.canDuplicateItems([root])).toBe(false)
  })

  it('allows duplicate for root items when root creation is available', () => {
    const root = createNote({ id: testId<'sidebarItems'>('note_root'), parentId: null })
    const runtime = createTestWorkspaceRuntime({
      activeItems: [root],
      canCreateItems: true,
    })
    const target = createWorkspaceFilesystemContextMenuTarget(runtime.filesystem)

    expect(target.canDuplicateItems([root])).toBe(true)
  })

  it('allows duplicate into an editable original folder without root creation access', () => {
    const folder = createFolder({
      id: testId<'sidebarItems'>('folder_1'),
      name: 'Scenes',
    })
    const note = createNote({
      id: testId<'sidebarItems'>('note_1'),
      parentId: folder.id,
    })
    const runtime = createTestWorkspaceRuntime({
      activeItems: [folder, note],
      canCreateItems: false,
    })
    const target = createWorkspaceFilesystemContextMenuTarget(runtime.filesystem)

    expect(target.canDuplicateItems([note])).toBe(true)
  })

  it('passes context-menu operations through to the workspace filesystem operation model', async () => {
    const first = createNote({ id: testId<'sidebarItems'>('note_1') })
    const second = createNote({ id: testId<'sidebarItems'>('note_2') })
    const trashItems = operationMock<FileSystemItemContextMenuOperations['trashItems']>()
    const restoreItems = operationMock<FileSystemItemContextMenuOperations['restoreItems']>()
    const requestDeleteItemsForever =
      operationMock<FileSystemItemContextMenuOperations['requestDeleteItemsForever']>()
    const requestEmptyTrash =
      operationMock<FileSystemItemContextMenuOperations['requestEmptyTrash']>()
    const pasteIntoTarget = operationMock<FileSystemItemContextMenuOperations['pasteIntoTarget']>(
      () => ({
        status: 'unavailable',
        reason: 'test_paste_unavailable',
      }),
    )
    const canPasteIntoTarget = operationMock<
      FileSystemItemContextMenuOperations['canPasteIntoTarget']
    >(() => true)
    const runtime = createTestWorkspaceRuntime({
      operations: {
        canPasteIntoTarget,
        requestEmptyTrash,
        pasteIntoTarget,
        requestDeleteItemsForever,
        restoreItems,
        trashItems,
      },
    })
    const target = createWorkspaceFilesystemContextMenuTarget(runtime.filesystem)
    const pasteInput = {
      clickedItem: first,
    }

    expect(target.canPasteIntoTarget(pasteInput)).toBe(true)
    await target.trashItems([first, second])
    await target.restoreItems([first, second], testId<'sidebarItems'>('folder_1'))
    await target.requestDeleteItemsForever([first, second])
    await target.requestEmptyTrash()
    expect(await target.pasteIntoTarget(pasteInput)).toEqual({
      status: 'unavailable',
      reason: 'test_paste_unavailable',
    })

    expect(canPasteIntoTarget).toHaveBeenCalledExactlyOnceWith(pasteInput)
    expect(trashItems).toHaveBeenCalledExactlyOnceWith(['note_1', 'note_2'])
    expect(restoreItems).toHaveBeenCalledExactlyOnceWith(['note_1', 'note_2'], 'folder_1')
    expect(requestDeleteItemsForever).toHaveBeenCalledExactlyOnceWith(['note_1', 'note_2'])
    expect(requestEmptyTrash).toHaveBeenCalledOnce()
    expect(pasteIntoTarget).toHaveBeenCalledExactlyOnceWith(pasteInput)
  })

  it('routes folder trash requests through the workspace filesystem operation model', async () => {
    const folder = createFolder({ id: testId<'sidebarItems'>('folder_1') })
    const child = createNote({
      id: testId<'sidebarItems'>('note_child'),
      parentId: folder.id,
    })
    const trashItems = operationMock<FileSystemItemContextMenuOperations['trashItems']>()
    const runtime = createTestWorkspaceRuntime({
      activeItems: [folder, child],
      operations: { trashItems },
    })
    const target = createWorkspaceFilesystemContextMenuTarget(runtime.filesystem)

    await target.trashItems([folder])

    expect(trashItems).toHaveBeenCalledExactlyOnceWith(['folder_1'])
  })
})

function operationMock<T extends (...args: Array<never>) => unknown>(implementation?: T) {
  return vi.fn<T>(implementation)
}
