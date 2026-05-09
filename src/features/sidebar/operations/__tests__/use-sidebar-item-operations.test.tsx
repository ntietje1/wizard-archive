import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { useSidebarItemOperationsValue } from '../useSidebarItemOperations'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import { buildSidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { testId } from '~/test/helpers/test-id'

const moveSidebarItems = vi.fn()
const duplicateSidebarItems = vi.fn()
const permanentlyDeleteSidebarItems = vi.fn()

let sidebarItems: Array<AnySidebarItem> = []
let trashItems: Array<AnySidebarItem> = []
let mutationHookCallIndex = 0

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({ campaignId: 'campaign_1' as Id<'campaigns'> }),
}))

vi.mock('~/features/sidebar/hooks/useEditorNavigation', () => ({
  useEditorNavigation: () => ({
    clearEditorContent: vi.fn(),
  }),
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useSidebarItems: (location: string) => ({
    data: location === SIDEBAR_ITEM_LOCATION.trash ? trashItems : sidebarItems,
    status: 'success',
    ...buildSidebarItemMaps(location === SIDEBAR_ITEM_LOCATION.trash ? trashItems : sidebarItems),
  }),
}))

vi.mock('~/features/sidebar/hooks/useSidebarItemsCache', () => ({
  useSidebarItemsCache: () => ({
    get: (location: string) =>
      location === SIDEBAR_ITEM_LOCATION.trash ? trashItems : sidebarItems,
    update: vi.fn(),
  }),
}))

vi.mock('~/shared/hooks/useCampaignMutation', () => ({
  useCampaignMutation: () => {
    const handlerIndex = mutationHookCallIndex++ % 3
    const handler =
      handlerIndex === 0
        ? moveSidebarItems
        : handlerIndex === 1
          ? permanentlyDeleteSidebarItems
          : duplicateSidebarItems
    return { mutateAsync: handler }
  },
}))

describe('useSidebarItemOperationsValue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mutationHookCallIndex = 0
    sidebarItems = []
    trashItems = []
    useSidebarUIStore.setState({
      selectedItemIds: [],
      anchorItemId: null,
      focusedItemId: null,
      activeItemSurface: null,
      selectionSurface: null,
      itemClipboard: null,
    })
  })

  it('preserves the full selected id set after moving normalized roots', async () => {
    const folder = createFolder({ name: 'Folder' })
    const child = createNote({ name: 'Child', parentId: folder._id })
    const target = createFolder({ name: 'Target' })
    sidebarItems = [folder, child, target]
    moveSidebarItems.mockResolvedValue([folder._id])
    useSidebarUIStore.getState().setActiveItemSurface({
      surface: 'sidebar',
      parentId: null,
      visibleItemIds: [folder._id, child._id, target._id],
    })
    useSidebarUIStore.getState().setSelectedItemIds([folder._id, child._id], folder._id)

    const { result } = renderHook(() => useSidebarItemOperationsValue())
    await act(async () => {
      await result.current.moveItems([folder, child], target._id)
    })

    expect(moveSidebarItems).toHaveBeenCalledWith({
      sourceItemIds: [folder._id],
      targetParentId: target._id,
      action: 'move',
      decisions: undefined,
    })
    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([folder._id, child._id])
    expect(useSidebarUIStore.getState().anchorItemId).toBe(folder._id)
  })

  it('normalizes restore from a trash folder surface to the sidebar root', async () => {
    const folder = createFolder({
      name: 'Folder',
      location: SIDEBAR_ITEM_LOCATION.trash,
      parentId: null,
    })
    trashItems = [folder]
    moveSidebarItems.mockResolvedValue([folder._id])
    useSidebarUIStore.getState().setActiveItemSurface({
      surface: 'folder-view',
      parentId: folder._id,
      visibleItemIds: [folder._id],
    })

    const { result } = renderHook(() => useSidebarItemOperationsValue())
    await act(async () => {
      await result.current.restoreItems([folder])
    })

    expect(moveSidebarItems).toHaveBeenCalledWith({
      sourceItemIds: [folder._id],
      targetParentId: null,
      action: 'restore',
      decisions: undefined,
    })
  })

  it('opens the conflict dialog before restoring into a taken name', async () => {
    const trashed = createNote({
      name: 'Meeting Notes',
      location: SIDEBAR_ITEM_LOCATION.trash,
      parentId: null,
    })
    const existing = createNote({ name: 'Meeting Notes', parentId: null })
    sidebarItems = [existing]
    trashItems = [trashed]
    moveSidebarItems.mockResolvedValue([trashed._id])

    const { result } = renderHook(() => useSidebarItemOperationsValue())
    await act(async () => {
      await result.current.restoreItems([trashed])
    })

    expect(moveSidebarItems).not.toHaveBeenCalled()

    render(result.current.dialog)
    expect(screen.getByRole('heading', { name: 'Resolve File Conflict' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Keep Both' }))

    await waitFor(() => {
      expect(moveSidebarItems).toHaveBeenCalledWith({
        sourceItemIds: [trashed._id],
        targetParentId: null,
        action: 'restore',
        decisions: [{ sourceItemId: trashed._id, action: 'keepBoth' }],
      })
    })
  })

  it('duplicates normalized roots through the batch duplicate mutation', async () => {
    const folder = createFolder({ name: 'Folder' })
    const child = createNote({ name: 'Child', parentId: folder._id })
    const target = createFolder({ name: 'Target' })
    sidebarItems = [folder, child, target]
    duplicateSidebarItems.mockResolvedValue([testId<'sidebarItems'>('copy_1')])

    const { result } = renderHook(() => useSidebarItemOperationsValue())
    await act(async () => {
      await result.current.duplicateItems([folder, child], target._id)
    })

    expect(duplicateSidebarItems).toHaveBeenCalledWith({
      sourceItemIds: [folder._id],
      targetParentId: target._id,
      decisions: undefined,
    })
  })

  it('permanently deletes normalized roots through the batch delete mutation', async () => {
    const folder = createFolder({
      name: 'Folder',
      location: SIDEBAR_ITEM_LOCATION.trash,
      parentId: null,
    })
    const child = createNote({
      name: 'Child',
      location: SIDEBAR_ITEM_LOCATION.trash,
      parentId: folder._id,
    })
    trashItems = [folder, child]
    permanentlyDeleteSidebarItems.mockResolvedValue([folder._id])

    const { result } = renderHook(() => useSidebarItemOperationsValue())
    await act(async () => {
      await result.current.permanentlyDeleteItems([folder, child])
    })

    expect(permanentlyDeleteSidebarItems).toHaveBeenCalledWith({
      sourceItemIds: [folder._id],
    })
  })
})
