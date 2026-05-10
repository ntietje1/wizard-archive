import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { useItemSurfaceHotkeys } from '../useItemSurfaceHotkeys'
import type { ItemSurfaceHotkeyOperations } from '../useItemSurfaceHotkeys'
import { buildSidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import { resetSidebarUIStore } from '~/test/helpers/store-helpers'

let sidebarItems: Array<AnySidebarItem> = []
let trashItems: Array<AnySidebarItem> = []

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({ campaignId: 'campaign_1' as Id<'campaigns'> }),
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useSidebarItems: (location: string) => ({
    data: location === SIDEBAR_ITEM_LOCATION.trash ? trashItems : sidebarItems,
    status: 'success',
    ...buildSidebarItemMaps(location === SIDEBAR_ITEM_LOCATION.trash ? trashItems : sidebarItems),
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

function createOperations(): ItemSurfaceHotkeyOperations {
  return {
    copyItems: vi.fn(),
    cutItems: vi.fn(),
    pasteClipboard: vi.fn().mockResolvedValue(undefined),
    trashItems: vi.fn().mockResolvedValue(undefined),
    confirmPermanentDeleteItems: vi.fn(),
    normalizeItems: (items) => items,
  }
}

describe('useItemSurfaceHotkeys', () => {
  beforeEach(() => {
    resetSidebarUIStore()
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
    useSidebarUIStore.getState().setItemClipboard({
      mode: 'cut',
      campaignId: 'campaign_1' as Id<'campaigns'>,
      itemIds: [note._id],
    })

    const operations = createOperations()
    renderHook(() => useItemSurfaceHotkeys(operations))

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(useSidebarUIStore.getState().itemClipboard).toBeNull()
    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([note._id])
    expect(operations.copyItems).not.toHaveBeenCalled()
    expect(operations.cutItems).not.toHaveBeenCalled()
    expect(operations.pasteClipboard).not.toHaveBeenCalled()
    expect(operations.trashItems).not.toHaveBeenCalled()
    expect(operations.confirmPermanentDeleteItems).not.toHaveBeenCalled()
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

    const operations = createOperations()
    renderHook(() => useItemSurfaceHotkeys(operations))

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(useSidebarUIStore.getState().itemClipboard).toBeNull()
    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([])
    expect(operations.copyItems).not.toHaveBeenCalled()
    expect(operations.cutItems).not.toHaveBeenCalled()
    expect(operations.pasteClipboard).not.toHaveBeenCalled()
    expect(operations.trashItems).not.toHaveBeenCalled()
    expect(operations.confirmPermanentDeleteItems).not.toHaveBeenCalled()
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
    useSidebarUIStore.getState().setItemClipboard({
      mode: 'copy',
      campaignId: 'campaign_1' as Id<'campaigns'>,
      itemIds: [clipboardItem._id],
    })
    const operations = createOperations()

    renderHook(() => useItemSurfaceHotkeys(operations))

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }))
    })

    expect(operations.pasteClipboard).toHaveBeenCalledWith(parentFolder._id)
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
    useSidebarUIStore.getState().setItemClipboard({
      mode: 'copy',
      campaignId: 'campaign_1' as Id<'campaigns'>,
      itemIds: [clipboardItem._id],
    })
    const operations = createOperations()

    renderHook(() => useItemSurfaceHotkeys(operations))

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }))
    })

    expect(operations.pasteClipboard).toHaveBeenCalledWith(null)
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
    useSidebarUIStore.getState().setItemClipboard({
      mode: 'copy',
      campaignId: 'campaign_1' as Id<'campaigns'>,
      itemIds: [clipboardItem._id],
    })
    const operations = createOperations()

    renderHook(() => useItemSurfaceHotkeys(operations))

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }))
    })

    expect(operations.pasteClipboard).toHaveBeenCalledWith(parentFolder._id)
  })
})
