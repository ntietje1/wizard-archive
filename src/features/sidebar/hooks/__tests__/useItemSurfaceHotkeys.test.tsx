import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { useItemSurfaceHotkeys } from '../useItemSurfaceHotkeys'
import { buildSidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import type { FileSystemValue } from '~/features/filesystem/useFileSystem'
import {
  setFileSystemClipboard,
  useFileSystemClipboardStore,
} from '~/features/filesystem/filesystem-clipboard-store'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import { resetSidebarUIStore } from '~/test/helpers/store-helpers'
import { testId } from '~/test/helpers/test-id'

let sidebarItems: Array<AnySidebarItem> = []
let trashItems: Array<AnySidebarItem> = []
let clipboardCanPaste = false

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({ campaignId: 'campaign_1' as Id<'campaigns'> }),
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useActiveSidebarItems: () => ({
    data: sidebarItems,
    status: 'success',
    ...buildSidebarItemMaps(sidebarItems),
  }),
  useTrashSidebarItems: () => ({
    data: trashItems,
    status: 'success',
    ...buildSidebarItemMaps(trashItems),
  }),
}))

vi.mock('~/features/sidebar/hooks/useEditorNavigation', () => ({
  useEditorNavigation: () => ({ navigateToItem: vi.fn() }),
}))

vi.mock('~/features/sidebar/hooks/useLastEditorItem', () => ({
  useLastEditorItem: () => ({ setLastSelectedItem: vi.fn() }),
}))

vi.mock('~/features/sidebar/hooks/useOpenParentFolders', () => ({
  useOpenParentFolders: () => ({ openParentFolders: vi.fn() }),
}))

function createFileSystem(overrides?: Partial<FileSystemValue>): FileSystemValue {
  return {
    createItem: vi.fn().mockResolvedValue(undefined),
    discardCreatedItem: vi.fn().mockResolvedValue(undefined),
    renameItem: vi.fn().mockResolvedValue(undefined),
    duplicateItems: vi.fn().mockResolvedValue(undefined),
    requestTrashItems: vi.fn().mockResolvedValue(false),
    restoreItems: vi.fn().mockResolvedValue(undefined),
    emptyTrash: vi.fn().mockResolvedValue(undefined),
    confirmDeleteForever: vi.fn(),
    copy: vi.fn(),
    cut: vi.fn(),
    cancelClipboard: vi.fn(() => {
      const store = useFileSystemClipboardStore.getState()
      if (!store.clipboard) return false
      store.clearClipboard()
      clipboardCanPaste = false
      return true
    }),
    canPaste: clipboardCanPaste,
    paste: vi.fn().mockResolvedValue(undefined),
    undo: vi.fn(),
    redo: vi.fn(),
    executeDrop: vi.fn().mockResolvedValue(undefined),
    canUndo: false,
    canRedo: false,
    ...overrides,
  }
}

function setupClipboardForPaste(mode: 'copy' | 'cut', itemIds: Array<Id<'sidebarItems'>>) {
  setFileSystemClipboard({
    mode,
    campaignId: 'campaign_1' as Id<'campaigns'>,
    itemIds,
  })
  clipboardCanPaste = true
}

describe('useItemSurfaceHotkeys', () => {
  beforeEach(() => {
    resetSidebarUIStore()
    useFileSystemClipboardStore.getState().clearClipboard()
    clipboardCanPaste = false
    sidebarItems = []
    trashItems = []
  })

  it('cancels an in-progress cut without clearing item selection', () => {
    const note = createNote()
    sidebarItems = [note]
    useSidebarUIStore.getState().setActiveItemSurface({
      surface: 'sidebar',
      parentId: null,
      visibleItemIds: [note._id],
    })
    useSidebarUIStore.getState().setSelectedItemIds([note._id], note._id)
    setupClipboardForPaste('cut', [note._id])

    const filesystem = createFileSystem()
    renderHook(() => useItemSurfaceHotkeys(filesystem))

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(useFileSystemClipboardStore.getState().clipboard).toBeNull()
    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([note._id])
    expect(filesystem.copy).not.toHaveBeenCalled()
    expect(filesystem.cut).not.toHaveBeenCalled()
    expect(filesystem.paste).not.toHaveBeenCalled()
    expect(filesystem.requestTrashItems).not.toHaveBeenCalled()
    expect(filesystem.confirmDeleteForever).not.toHaveBeenCalled()
  })

  it('clears item selection on Escape when no clipboard operation is active', () => {
    const note = createNote()
    sidebarItems = [note]
    useSidebarUIStore.getState().setActiveItemSurface({
      surface: 'sidebar',
      parentId: null,
      visibleItemIds: [note._id],
    })
    useSidebarUIStore.getState().setSelectedItemIds([note._id], note._id)

    const filesystem = createFileSystem()
    renderHook(() => useItemSurfaceHotkeys(filesystem))

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(useFileSystemClipboardStore.getState().clipboard).toBeNull()
    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([])
    expect(filesystem.copy).not.toHaveBeenCalled()
    expect(filesystem.cut).not.toHaveBeenCalled()
    expect(filesystem.paste).not.toHaveBeenCalled()
    expect(filesystem.requestTrashItems).not.toHaveBeenCalled()
    expect(filesystem.confirmDeleteForever).not.toHaveBeenCalled()
  })

  it('clears item selection on Escape even when no item surface is active', () => {
    const note = createNote()
    sidebarItems = [note]
    useSidebarUIStore.getState().setSelectedItemIds([note._id], note._id)

    const filesystem = createFileSystem()
    renderHook(() => useItemSurfaceHotkeys(filesystem))

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([])
  })

  it('pastes into the current folder surface instead of a selected child folder', () => {
    const parentFolder = createFolder()
    const selectedChildFolder = createFolder({ parentId: parentFolder._id })
    const clipboardItem = createNote()
    sidebarItems = [parentFolder, selectedChildFolder, clipboardItem]
    useSidebarUIStore.getState().setActiveItemSurface({
      surface: 'folder-view',
      parentId: parentFolder._id,
      visibleItemIds: [selectedChildFolder._id],
    })
    useSidebarUIStore
      .getState()
      .setSelectedItemIds([selectedChildFolder._id], selectedChildFolder._id)
    setupClipboardForPaste('copy', [clipboardItem._id])
    const filesystem = createFileSystem()

    renderHook(() => useItemSurfaceHotkeys(filesystem))

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }))
    })

    expect(filesystem.paste).toHaveBeenCalledWith(parentFolder._id)
  })

  it('pastes into the sidebar root instead of a selected root folder', () => {
    const selectedFolder = createFolder()
    const clipboardItem = createNote()
    sidebarItems = [selectedFolder, clipboardItem]
    useSidebarUIStore.getState().setActiveItemSurface({
      surface: 'sidebar',
      parentId: null,
      visibleItemIds: [selectedFolder._id],
    })
    useSidebarUIStore.getState().setSelectedItemIds([selectedFolder._id], selectedFolder._id)
    setupClipboardForPaste('copy', [clipboardItem._id])
    const filesystem = createFileSystem()

    renderHook(() => useItemSurfaceHotkeys(filesystem))

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }))
    })

    expect(filesystem.paste).toHaveBeenCalledWith(null)
  })

  it('pastes sidebar-tree selections into the selected items common parent folder', () => {
    const parentFolder = createFolder()
    const selectedNote = createNote({ parentId: parentFolder._id })
    const selectedFolder = createFolder({ parentId: parentFolder._id })
    const clipboardItem = createNote()
    sidebarItems = [parentFolder, selectedNote, selectedFolder, clipboardItem]
    useSidebarUIStore.getState().setActiveItemSurface({
      surface: 'sidebar',
      parentId: null,
      visibleItemIds: [parentFolder._id, selectedNote._id, selectedFolder._id],
    })
    useSidebarUIStore
      .getState()
      .setSelectedItemIds([selectedNote._id, selectedFolder._id], selectedNote._id)
    setupClipboardForPaste('copy', [clipboardItem._id])
    const filesystem = createFileSystem()

    renderHook(() => useItemSurfaceHotkeys(filesystem))

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }))
    })

    expect(filesystem.paste).toHaveBeenCalledWith(parentFolder._id)
  })

  it('uses the latest selected item ids when a hotkey fires before React rerenders', () => {
    const staleNote = createNote()
    const currentNote = createNote()
    sidebarItems = [staleNote, currentNote]
    useSidebarUIStore.getState().setActiveItemSurface({
      surface: 'sidebar',
      parentId: null,
      visibleItemIds: [staleNote._id, currentNote._id],
    })
    useSidebarUIStore.getState().setSelectedItemIds([staleNote._id], staleNote._id)
    const filesystem = createFileSystem()

    renderHook(() => useItemSurfaceHotkeys(filesystem))
    useSidebarUIStore.getState().setSelectedItemIds([currentNote._id], currentNote._id)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))
    })

    expect(filesystem.requestTrashItems).toHaveBeenCalledWith([currentNote._id])
  })

  it('ignores selected ids that are not visible in the active surface', () => {
    const hiddenNote = createNote()
    sidebarItems = [hiddenNote]
    useSidebarUIStore.getState().setActiveItemSurface({
      surface: 'folder-view',
      parentId: testId<'sidebarItems'>('folder_1'),
      visibleItemIds: [],
    })
    useSidebarUIStore.getState().setSelectedItemIds([hiddenNote._id], hiddenNote._id)
    const filesystem = createFileSystem()

    renderHook(() => useItemSurfaceHotkeys(filesystem))

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))
    })

    expect(filesystem.requestTrashItems).not.toHaveBeenCalled()
  })
})
