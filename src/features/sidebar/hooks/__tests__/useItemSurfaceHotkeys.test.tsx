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
    renameItem: vi.fn().mockResolvedValue(undefined),
    moveItems: vi.fn().mockResolvedValue(undefined),
    copyItems: vi.fn().mockResolvedValue(undefined),
    trashItems: vi.fn().mockResolvedValue(undefined),
    restoreItems: vi.fn().mockResolvedValue(undefined),
    deleteForever: vi.fn().mockResolvedValue(undefined),
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
    executeDropCommand: vi.fn().mockResolvedValue(undefined),
    canUndo: false,
    canRedo: false,
    ...overrides,
  }
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
    setFileSystemClipboard({
      mode: 'cut',
      campaignId: 'campaign_1' as Id<'campaigns'>,
      itemIds: [note._id],
    })
    clipboardCanPaste = true

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
    expect(filesystem.trashItems).not.toHaveBeenCalled()
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
    expect(filesystem.trashItems).not.toHaveBeenCalled()
    expect(filesystem.confirmDeleteForever).not.toHaveBeenCalled()
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
    setFileSystemClipboard({
      mode: 'copy',
      campaignId: 'campaign_1' as Id<'campaigns'>,
      itemIds: [clipboardItem._id],
    })
    clipboardCanPaste = true
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
    setFileSystemClipboard({
      mode: 'copy',
      campaignId: 'campaign_1' as Id<'campaigns'>,
      itemIds: [clipboardItem._id],
    })
    clipboardCanPaste = true
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
    setFileSystemClipboard({
      mode: 'copy',
      campaignId: 'campaign_1' as Id<'campaigns'>,
      itemIds: [clipboardItem._id],
    })
    clipboardCanPaste = true
    const filesystem = createFileSystem()

    renderHook(() => useItemSurfaceHotkeys(filesystem))

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }))
    })

    expect(filesystem.paste).toHaveBeenCalledWith(parentFolder._id)
  })
})
