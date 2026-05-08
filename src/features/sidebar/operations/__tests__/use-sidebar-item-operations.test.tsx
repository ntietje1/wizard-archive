import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { useSidebarItemOperationsValue } from '../useSidebarItemOperations'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import { buildSidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'

const moveSidebarItems = vi.fn()
const duplicateSidebarItems = vi.fn()
const permanentlyDeleteSidebarItems = vi.fn()
const mutationMocks = [moveSidebarItems, permanentlyDeleteSidebarItems, duplicateSidebarItems]

let sidebarItems: Array<AnySidebarItem> = []
let trashItems: Array<AnySidebarItem> = []
let mutationCallIndex = 0

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
  useCampaignMutation: () => ({ mutateAsync: mutationMocks[mutationCallIndex++ % 3] }),
}))

describe('useSidebarItemOperationsValue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mutationCallIndex = 0
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
})
