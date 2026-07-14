import type { ResourceId } from '../../../resources/domain-id'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { RESOURCE_STATUS } from '../../items-persistence-contract'
import type { AnyItem } from '../../items'

import { useItemSurfaceHotkeys } from '../use-item-surface-hotkeys'
import type { HotkeyFileSystemActions } from '../use-item-surface-hotkeys'
import { setFileSystemClipboard } from '../../../filesystem/clipboard'
import { createFolder, createNote } from '../../../test/sidebar-item-factory'
import { createResourceCatalogModel } from '../../../filesystem/catalog'
import {
  createSidebarWorkspaceStateHarness,
  createSidebarWorkspaceStateWrapper,
} from './test-helpers'

let sidebarItems: Array<AnyItem> = []
let trashItems: Array<AnyItem> = []
let clipboardCanPaste = false
const openItemMock = vi.hoisted(() => vi.fn())

function createFileSystem(overrides?: Partial<HotkeyFileSystemActions>): HotkeyFileSystemActions {
  const filesystem = {
    requestTrashItems: vi.fn().mockResolvedValue({ status: 'unavailable', reason: 'test' }),
    confirmDeleteForever: vi.fn(),
    copy: vi.fn(),
    cut: vi.fn(),
    canUseClipboardOperations: true,
    canDeleteItemsForever: vi.fn(() => true),
    canRenameItem: vi.fn(() => true),
    canTrashItems: vi.fn(() => true),
    cancelClipboard: vi.fn(() => {
      if (!clipboardCanPaste) return false
      setFileSystemClipboard(null)
      clipboardCanPaste = false
      return true
    }),
    get canPaste() {
      return clipboardCanPaste
    },
    paste: vi.fn().mockResolvedValue({ status: 'unavailable', reason: 'test' }),
    resolveOperationItems: ({ itemIds }) => {
      const { operationItems } = createResourceCatalogModel({
        activeItems: sidebarItems,
        trashItems,
      })
      return operationItems.resolveItems({ itemIds })
    },
    getVisibleAncestors: (itemId) =>
      createResourceCatalogModel({
        activeItems: sidebarItems,
        trashItems,
      }).catalog.getVisibleAncestors(itemId),
    openItem: openItemMock,
    ...overrides,
  } satisfies HotkeyFileSystemActions
  return filesystem
}

function setupClipboardForPaste(mode: 'copy' | 'cut', itemIds: Array<ResourceId>) {
  setFileSystemClipboard({
    mode,
    workspaceId: 'workspace_1',
    itemIds,
  })
  clipboardCanPaste = true
}

describe('useItemSurfaceHotkeys', () => {
  beforeEach(() => {
    setFileSystemClipboard(null)
    clipboardCanPaste = false
    openItemMock.mockReset()
    openItemMock.mockResolvedValue(undefined)
    sidebarItems = []
    trashItems = []
  })

  it('cancels an in-progress cut and preserves the selected item', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const note = createNote()
    sidebarItems = [note]
    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [note.id],
      })
      sidebar.current.selectionCommands.setSelectedItemIds([note.id], note.id)
    })
    setupClipboardForPaste('cut', [note.id])

    const filesystem = createFileSystem()
    renderHook(() => useItemSurfaceHotkeys(filesystem), {
      wrapper: createSidebarWorkspaceStateWrapper({
        workspaceId: sidebar.workspaceId,
        sort: sidebar.sort,
      }),
    })

    act(() => {
      dispatchItemSurfaceKeyboardEvent('Escape')
    })

    expect(filesystem.cancelClipboard).toHaveBeenCalledTimes(1)
    expect(clipboardCanPaste).toBe(false)
    expect(sidebar.current.selection.selectedItemIds).toEqual([note.id])
  })

  it('ignores unscoped Escape presses when no item surface is active', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const note = createNote()
    sidebarItems = [note]
    act(() => {
      sidebar.current.selectionCommands.setSelectedItemIds([note.id], note.id)
    })
    setupClipboardForPaste('cut', [note.id])
    const filesystem = createFileSystem()

    renderHook(() => useItemSurfaceHotkeys(filesystem), {
      wrapper: createSidebarWorkspaceStateWrapper({
        workspaceId: sidebar.workspaceId,
        sort: sidebar.sort,
      }),
    })

    act(() => {
      window.dispatchEvent(createKeyboardEvent('Escape', { target: document.body }))
    })

    expect(filesystem.cancelClipboard).not.toHaveBeenCalled()
    expect(clipboardCanPaste).toBe(true)
    expect(sidebar.current.selection.selectedItemIds).toEqual([note.id])
  })

  it('pastes folder-view clipboard content into the current folder surface', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const parentFolder = createFolder()
    const selectedChildFolder = createFolder({ parentId: parentFolder.id })
    const clipboardItem = createNote()
    sidebarItems = [parentFolder, selectedChildFolder, clipboardItem]
    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'folder-view',
        parentId: parentFolder.id,
        visibleItemIds: [selectedChildFolder.id],
      })
      sidebar.current.selectionCommands.setSelectedItemIds(
        [selectedChildFolder.id],
        selectedChildFolder.id,
      )
    })
    setupClipboardForPaste('copy', [clipboardItem.id])
    const filesystem = createFileSystem()

    renderHook(() => useItemSurfaceHotkeys(filesystem), {
      wrapper: createSidebarWorkspaceStateWrapper({
        workspaceId: sidebar.workspaceId,
        sort: sidebar.sort,
      }),
    })

    act(() => {
      dispatchItemSurfaceKeyboardEvent('v', { ctrlKey: true })
    })

    expect(filesystem.paste).toHaveBeenCalledWith(parentFolder.id)
  })

  it('pastes sidebar clipboard content into the sidebar root surface', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const selectedFolder = createFolder()
    const clipboardItem = createNote()
    sidebarItems = [selectedFolder, clipboardItem]
    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [selectedFolder.id],
      })
      sidebar.current.selectionCommands.setSelectedItemIds([selectedFolder.id], selectedFolder.id)
    })
    setupClipboardForPaste('copy', [clipboardItem.id])
    const filesystem = createFileSystem()

    renderHook(() => useItemSurfaceHotkeys(filesystem), {
      wrapper: createSidebarWorkspaceStateWrapper({
        workspaceId: sidebar.workspaceId,
        sort: sidebar.sort,
      }),
    })

    act(() => {
      dispatchItemSurfaceKeyboardEvent('v', { ctrlKey: true })
    })

    expect(filesystem.paste).toHaveBeenCalledWith(null)
  })

  it('does not paste when clipboard operations are enabled but content is not pasteable', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const selectedFolder = createFolder()
    const clipboardItem = createNote()
    sidebarItems = [selectedFolder, clipboardItem]
    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [selectedFolder.id],
      })
      sidebar.current.selectionCommands.setSelectedItemIds([selectedFolder.id], selectedFolder.id)
    })
    setFileSystemClipboard({
      mode: 'copy',
      workspaceId: 'workspace_1',
      itemIds: [clipboardItem.id],
    })
    clipboardCanPaste = false
    const filesystem = createFileSystem()

    renderHook(() => useItemSurfaceHotkeys(filesystem), {
      wrapper: createSidebarWorkspaceStateWrapper({
        workspaceId: sidebar.workspaceId,
        sort: sidebar.sort,
      }),
    })

    act(() => {
      const event = dispatchItemSurfaceKeyboardEvent('v', { ctrlKey: true })

      expect(event.defaultPrevented).toBe(false)
    })

    expect(filesystem.paste).not.toHaveBeenCalled()
  })

  it('pastes sidebar-tree selections into the selected items common parent folder', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const parentFolder = createFolder()
    const selectedNote = createNote({ parentId: parentFolder.id })
    const selectedFolder = createFolder({ parentId: parentFolder.id })
    const clipboardItem = createNote()
    sidebarItems = [parentFolder, selectedNote, selectedFolder, clipboardItem]
    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [parentFolder.id, selectedNote.id, selectedFolder.id],
      })
      sidebar.current.selectionCommands.setSelectedItemIds(
        [selectedNote.id, selectedFolder.id],
        selectedNote.id,
      )
    })
    setupClipboardForPaste('copy', [clipboardItem.id])
    const filesystem = createFileSystem()

    renderHook(() => useItemSurfaceHotkeys(filesystem), {
      wrapper: createSidebarWorkspaceStateWrapper({
        workspaceId: sidebar.workspaceId,
        sort: sidebar.sort,
      }),
    })

    act(() => {
      dispatchItemSurfaceKeyboardEvent('v', { ctrlKey: true })
    })

    expect(filesystem.paste).toHaveBeenCalledWith(parentFolder.id)
  })

  it('pastes mixed-parent sidebar selections into the sidebar surface root', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const firstParent = createFolder()
    const secondParent = createFolder()
    const firstNote = createNote({ parentId: firstParent.id })
    const secondNote = createNote({ parentId: secondParent.id })
    const clipboardItem = createNote()
    sidebarItems = [firstParent, secondParent, firstNote, secondNote, clipboardItem]
    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [firstParent.id, firstNote.id, secondParent.id, secondNote.id],
      })
      sidebar.current.selectionCommands.setSelectedItemIds([firstNote.id, secondNote.id])
    })
    setupClipboardForPaste('copy', [clipboardItem.id])
    const filesystem = createFileSystem()

    renderHook(() => useItemSurfaceHotkeys(filesystem), {
      wrapper: createSidebarWorkspaceStateWrapper({
        workspaceId: sidebar.workspaceId,
        sort: sidebar.sort,
      }),
    })

    act(() => {
      dispatchItemSurfaceKeyboardEvent('v', { ctrlKey: true })
    })

    expect(filesystem.paste).toHaveBeenCalledWith(null)
  })

  it('uses the latest selected item ids when a hotkey fires before React rerenders', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const staleNote = createNote()
    const currentNote = createNote()
    sidebarItems = [staleNote, currentNote]
    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [staleNote.id, currentNote.id],
      })
      sidebar.current.selectionCommands.setSelectedItemIds([staleNote.id], staleNote.id)
    })
    const filesystem = createFileSystem()

    renderHook(() => useItemSurfaceHotkeys(filesystem), {
      wrapper: createSidebarWorkspaceStateWrapper({
        workspaceId: sidebar.workspaceId,
        sort: sidebar.sort,
      }),
    })
    act(() => {
      sidebar.current.selectionCommands.setSelectedItemIds([currentNote.id], currentNote.id)
    })

    act(() => {
      dispatchItemSurfaceKeyboardEvent('Delete')
    })

    expect(filesystem.requestTrashItems).toHaveBeenCalledWith([currentNote.id])
  })

  it('leaves delete hotkeys unhandled when trash capability is unavailable', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const note = createNote()
    sidebarItems = [note]
    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [note.id],
      })
      sidebar.current.selectionCommands.setSelectedItemIds([note.id], note.id)
    })
    const filesystem = createFileSystem({ canTrashItems: () => false })
    renderHook(() => useItemSurfaceHotkeys(filesystem), {
      wrapper: createSidebarWorkspaceStateWrapper({
        workspaceId: sidebar.workspaceId,
        sort: sidebar.sort,
      }),
    })

    let event!: KeyboardEvent
    act(() => {
      event = dispatchItemSurfaceKeyboardEvent('Delete')
    })

    expect(event.defaultPrevented).toBe(false)
    expect(filesystem.requestTrashItems).not.toHaveBeenCalled()
  })

  it('ignores Enter from nested interactive controls inside an item surface', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const note = createNote({})
    sidebarItems = [note]
    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [note.id],
      })
      sidebar.current.selectionCommands.setSelectedItemIds([note.id], note.id)
    })
    const filesystem = createFileSystem()

    renderHook(() => useItemSurfaceHotkeys(filesystem), {
      wrapper: createSidebarWorkspaceStateWrapper({
        workspaceId: sidebar.workspaceId,
        sort: sidebar.sort,
      }),
    })

    const surface = document.createElement('div')
    surface.dataset.itemSurfaceHotkeyTarget = 'true'
    const button = document.createElement('button')
    surface.append(button)
    document.body.append(surface)

    act(() => {
      window.dispatchEvent(createKeyboardEvent('Enter', { target: button }))
    })

    expect(openItemMock).not.toHaveBeenCalled()
    surface.remove()
  })

  it('ignores item-surface key events owned by another runtime host', () => {
    const firstSidebar = createSidebarWorkspaceStateHarness()
    const secondSidebar = createSidebarWorkspaceStateHarness()
    const firstNote = createNote({})
    const secondNote = createNote({})
    sidebarItems = [firstNote, secondNote]
    act(() => {
      firstSidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [firstNote.id],
      })
      firstSidebar.current.selectionCommands.setSelectedItemIds([firstNote.id], firstNote.id)
      secondSidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [secondNote.id],
      })
      secondSidebar.current.selectionCommands.setSelectedItemIds([secondNote.id], secondNote.id)
    })
    const firstFilesystem = createFileSystem()
    const secondFilesystem = createFileSystem()
    const firstScope = document.createElement('section')
    const secondScope = document.createElement('section')
    const firstTarget = document.createElement('div')
    const secondTarget = document.createElement('div')
    firstTarget.dataset.itemSurfaceHotkeyTarget = 'true'
    secondTarget.dataset.itemSurfaceHotkeyTarget = 'true'
    firstScope.append(firstTarget)
    secondScope.append(secondTarget)
    document.body.append(firstScope, secondScope)

    renderHook(
      () => useItemSurfaceHotkeys(secondFilesystem, { scopeRef: { current: secondScope } }),
      {
        wrapper: createSidebarWorkspaceStateWrapper({
          workspaceId: secondSidebar.workspaceId,
          sort: secondSidebar.sort,
        }),
      },
    )
    renderHook(
      () => useItemSurfaceHotkeys(firstFilesystem, { scopeRef: { current: firstScope } }),
      {
        wrapper: createSidebarWorkspaceStateWrapper({
          workspaceId: firstSidebar.workspaceId,
          sort: firstSidebar.sort,
        }),
      },
    )

    act(() => {
      window.dispatchEvent(createKeyboardEvent('Delete', { target: firstTarget }))
    })

    expect(firstFilesystem.requestTrashItems).toHaveBeenCalledWith([firstNote.id])
    expect(secondFilesystem.requestTrashItems).not.toHaveBeenCalled()
    firstScope.remove()
    secondScope.remove()
  })

  it('removes the global hotkey listener on unmount', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const note = createNote()
    sidebarItems = [note]
    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [note.id],
      })
      sidebar.current.selectionCommands.setSelectedItemIds([note.id], note.id)
    })
    const filesystem = createFileSystem()
    const { unmount } = renderHook(() => useItemSurfaceHotkeys(filesystem), {
      wrapper: createSidebarWorkspaceStateWrapper({
        workspaceId: sidebar.workspaceId,
        sort: sidebar.sort,
      }),
    })

    unmount()

    act(() => {
      dispatchItemSurfaceKeyboardEvent('Delete')
    })

    expect(filesystem.requestTrashItems).not.toHaveBeenCalled()
  })

  it('ignores repeated mutating keydown events while keeping arrow navigation available', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const firstNote = createNote({})
    const secondNote = createNote({})
    sidebarItems = [firstNote, secondNote]
    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [firstNote.id, secondNote.id],
      })
      sidebar.current.selectionCommands.setSelectedItemIds([firstNote.id], firstNote.id)
    })
    const filesystem = createFileSystem()

    renderHook(() => useItemSurfaceHotkeys(filesystem), {
      wrapper: createSidebarWorkspaceStateWrapper({
        workspaceId: sidebar.workspaceId,
        sort: sidebar.sort,
      }),
    })

    act(() => {
      const repeatDelete = dispatchItemSurfaceKeyboardEvent('Delete', { repeat: true })
      dispatchItemSurfaceKeyboardEvent('ArrowDown', { repeat: true })

      expect(repeatDelete.defaultPrevented).toBe(true)
    })

    expect(filesystem.requestTrashItems).not.toHaveBeenCalled()
    expect(sidebar.current.selection.focusedItemId).toBe(secondNote.id)
  })

  it('leaves modified arrow shortcuts to the browser', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const firstNote = createNote({})
    const secondNote = createNote({})
    sidebarItems = [firstNote, secondNote]
    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [firstNote.id, secondNote.id],
      })
      sidebar.current.selectionCommands.setSelectedItemIds([firstNote.id], firstNote.id)
    })
    const filesystem = createFileSystem()

    renderHook(() => useItemSurfaceHotkeys(filesystem), {
      wrapper: createSidebarWorkspaceStateWrapper({
        workspaceId: sidebar.workspaceId,
        sort: sidebar.sort,
      }),
    })

    const modifiedArrowEvents: Array<KeyboardEvent> = []
    act(() => {
      modifiedArrowEvents.push(dispatchItemSurfaceKeyboardEvent('ArrowDown', { ctrlKey: true }))
    })

    expect(modifiedArrowEvents[0]?.defaultPrevented).toBe(false)
    expect(sidebar.current.selection.focusedItemId).toBe(firstNote.id)
  })

  it('preserves default behavior for repeated unsupported keys', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const note = createNote()
    sidebarItems = [note]
    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [note.id],
      })
      sidebar.current.selectionCommands.setSelectedItemIds([note.id], note.id)
    })
    const filesystem = createFileSystem()

    renderHook(() => useItemSurfaceHotkeys(filesystem), {
      wrapper: createSidebarWorkspaceStateWrapper({
        workspaceId: sidebar.workspaceId,
        sort: sidebar.sort,
      }),
    })

    const repeatUnsupportedKeyEvents: Array<KeyboardEvent> = []
    act(() => {
      repeatUnsupportedKeyEvents.push(dispatchItemSurfaceKeyboardEvent('z', { repeat: true }))
    })

    expect(repeatUnsupportedKeyEvents[0]?.defaultPrevented).toBe(false)
  })

  it('deletes selected trash items forever through the filesystem catalog', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const trashedNote = createNote({ status: RESOURCE_STATUS.trashed })
    trashItems = [trashedNote]
    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'trash',
        parentId: null,
        visibleItemIds: [trashedNote.id],
      })
      sidebar.current.selectionCommands.setSelectedItemIds([trashedNote.id], trashedNote.id)
    })
    const filesystem = createFileSystem()

    renderHook(() => useItemSurfaceHotkeys(filesystem), {
      wrapper: createSidebarWorkspaceStateWrapper({
        workspaceId: sidebar.workspaceId,
        sort: sidebar.sort,
      }),
    })

    act(() => {
      dispatchItemSurfaceKeyboardEvent('Delete')
    })

    expect(filesystem.confirmDeleteForever).toHaveBeenCalledWith([trashedNote.id])
  })

  it('does not permanently delete through a hotkey when the capability is unavailable', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const trashedNote = createNote({ status: RESOURCE_STATUS.trashed })
    trashItems = [trashedNote]
    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'trash',
        parentId: null,
        visibleItemIds: [trashedNote.id],
      })
      sidebar.current.selectionCommands.setSelectedItemIds([trashedNote.id], trashedNote.id)
    })
    const filesystem = createFileSystem({ canDeleteItemsForever: () => false })
    renderHook(() => useItemSurfaceHotkeys(filesystem), {
      wrapper: createSidebarWorkspaceStateWrapper({
        workspaceId: sidebar.workspaceId,
        sort: sidebar.sort,
      }),
    })

    act(() => {
      dispatchItemSurfaceKeyboardEvent('Delete')
    })

    expect(filesystem.confirmDeleteForever).not.toHaveBeenCalled()
  })

  it('opens the selected item through the supplied filesystem action', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const note = createNote({})
    sidebarItems = [note]
    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [note.id],
      })
      sidebar.current.selectionCommands.setSelectedItemIds([note.id], note.id)
    })
    const filesystem = createFileSystem()

    renderHook(() => useItemSurfaceHotkeys(filesystem), {
      wrapper: createSidebarWorkspaceStateWrapper({
        workspaceId: sidebar.workspaceId,
        sort: sidebar.sort,
      }),
    })

    act(() => {
      dispatchItemSurfaceKeyboardEvent('Enter')
    })

    expect(openItemMock).toHaveBeenCalledWith(note.id)
  })

  it('reveals parent folders before starting keyboard rename', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const folder = createFolder()
    const note = createNote({ parentId: folder.id })
    sidebarItems = [folder, note]
    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [folder.id, note.id],
      })
      sidebar.current.selectionCommands.setSelectedItemIds([note.id], note.id)
    })
    const filesystem = createFileSystem()

    renderHook(() => useItemSurfaceHotkeys(filesystem), {
      wrapper: createSidebarWorkspaceStateWrapper({
        workspaceId: sidebar.workspaceId,
        sort: sidebar.sort,
      }),
    })

    act(() => {
      dispatchItemSurfaceKeyboardEvent('F2')
    })

    expect(sidebar.current.ui.folderStates[folder.id]).toBe(true)
    expect(sidebar.current.editing.renamingItemId).toBe(note.id)
  })

  it('does not start keyboard rename when the capability is unavailable', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const note = createNote()
    sidebarItems = [note]
    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [note.id],
      })
      sidebar.current.selectionCommands.setSelectedItemIds([note.id], note.id)
    })
    const filesystem = createFileSystem({ canRenameItem: () => false })
    renderHook(() => useItemSurfaceHotkeys(filesystem), {
      wrapper: createSidebarWorkspaceStateWrapper({
        workspaceId: sidebar.workspaceId,
        sort: sidebar.sort,
      }),
    })

    act(() => {
      dispatchItemSurfaceKeyboardEvent('F2')
    })

    expect(sidebar.current.editing.renamingItemId).toBeNull()
  })

  it('exits close-all mode when revealing parent folders for keyboard rename', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const folder = createFolder()
    const note = createNote({ parentId: folder.id })
    sidebarItems = [folder, note]
    act(() => {
      sidebar.current.uiCommands.toggleCloseAllFoldersMode()
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [folder.id, note.id],
      })
      sidebar.current.selectionCommands.setSelectedItemIds([note.id], note.id)
    })
    const filesystem = createFileSystem()

    renderHook(() => useItemSurfaceHotkeys(filesystem), {
      wrapper: createSidebarWorkspaceStateWrapper({
        workspaceId: sidebar.workspaceId,
        sort: sidebar.sort,
      }),
    })

    act(() => {
      dispatchItemSurfaceKeyboardEvent('F2')
    })

    expect(sidebar.current.ui.closeAllFoldersMode).toBe(false)
    expect(sidebar.current.ui.folderStates[folder.id]).toBe(true)
    expect(sidebar.current.editing.renamingItemId).toBe(note.id)
  })
})

function createKeyboardEvent(
  key: string,
  options: KeyboardEventInit & { target?: EventTarget | null } = {},
) {
  const { target, ...eventInit } = options
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...eventInit })

  if (target) {
    Object.defineProperty(event, 'target', { value: target })
  }

  return event
}

function dispatchItemSurfaceKeyboardEvent(key: string, options: KeyboardEventInit = {}) {
  const target = document.createElement('div')
  target.dataset.itemSurfaceHotkeyTarget = 'true'
  document.body.append(target)

  const event = createKeyboardEvent(key, { ...options, target })
  window.dispatchEvent(event)

  target.remove()
  return event
}
