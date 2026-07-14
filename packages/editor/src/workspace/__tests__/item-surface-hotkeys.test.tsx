import { testResourceId } from '../../../../../shared/test/resource-id'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { HotkeyFileSystemActions } from '../sidebar/use-item-surface-hotkeys'
import { WorkspaceRuntimeItemSurfaceHotkeys } from '../item-surface-hotkeys'
import { createWorkspaceResource } from '../runtime'
import { createFolder, createNote } from '../../test/sidebar-item-factory'
import { createTestWorkspaceRuntime } from '../../test/workspace-runtime-factory'

let capturedHotkeyActions: HotkeyFileSystemActions | null = null

vi.mock('../sidebar/use-item-surface-hotkeys', () => ({
  useItemSurfaceHotkeys: (actions: HotkeyFileSystemActions) => {
    capturedHotkeyActions = actions
  },
}))

describe('WorkspaceRuntimeItemSurfaceHotkeys', () => {
  it('routes item-surface hotkey actions through workspace runtime operations', async () => {
    const folder = createFolder({ id: testResourceId('folder_1') })
    const note = createNote({ id: testResourceId('note_1'), parentId: folder.id })
    const copyItems = vi.fn()
    const cutItems = vi.fn()
    const pasteResult = { status: 'unavailable' as const, reason: 'operation-pending' }
    const trashResult = { status: 'rejected' as const, reason: 'stale-history' as const }
    const paste = vi.fn().mockResolvedValue(pasteResult)
    const trashItems = vi.fn().mockResolvedValue(trashResult)
    const requestDeleteItemsForever = vi.fn()
    const openItem = vi.fn()
    const runtime = createTestWorkspaceRuntime({
      activeItems: [folder, note],
      navigation: { openItem },
      operations: {
        clipboard: {
          status: 'available',
          canPaste: true,
          cancel: vi.fn(() => true),
          copyItems,
          cutItems,
          paste,
        },
        requestDeleteItemsForever,
        trashItems,
      },
    })

    render(<WorkspaceRuntimeItemSurfaceHotkeys runtime={runtime} />)
    const actions = capturedHotkeyActions
    if (!actions) throw new Error('Expected item-surface hotkey actions to be registered')

    actions.copy([note.id])
    actions.cut([note.id])
    await expect(actions.paste(folder.id)).resolves.toBe(pasteResult)
    await expect(actions.requestTrashItems([note.id])).resolves.toBe(trashResult)
    actions.confirmDeleteForever([note.id])
    actions.openItem(note.id)

    expect(copyItems).toHaveBeenCalledWith([note.id])
    expect(cutItems).toHaveBeenCalledWith([note.id])
    expect(paste).toHaveBeenCalledWith(folder.id)
    expect(trashItems).toHaveBeenCalledWith([note.id])
    expect(requestDeleteItemsForever).toHaveBeenCalledWith([note.id])
    expect(openItem).toHaveBeenCalledWith(createWorkspaceResource(note.id))
    expect(actions.getVisibleAncestors(note.id)).toEqual([folder])
    expect(actions.resolveOperationItems({ itemIds: [note.id] })).toEqual([note])
  })
})
