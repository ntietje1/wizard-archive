import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
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

function moveResult(overrides: Partial<Awaited<ReturnType<typeof moveSidebarItems>>> = {}) {
  return {
    affectedItemIds: [],
    movedSourceItemIds: [],
    restoredSourceItemIds: [],
    trashedSourceItemIds: [],
    mergedSourceItemIds: [],
    skippedSourceItemIds: [],
    noopSourceItemIds: [],
    ...overrides,
  }
}

function duplicateResult(
  overrides: Partial<Awaited<ReturnType<typeof duplicateSidebarItems>>> = {},
) {
  return {
    createdItemIds: [],
    createdRootItemIds: [],
    copiedSourceItemIds: [],
    replacedSourceItemIds: [],
    mergedSourceItemIds: [],
    skippedSourceItemIds: [],
    ...overrides,
  }
}

function permanentDeleteResult(deletedRootItemIds: Array<Id<'sidebarItems'>> = []) {
  return { deletedRootItemIds }
}

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({
    campaignId: 'campaign_1' as Id<'campaigns'>,
    campaign: { data: { myMembership: { userId: null } } },
  }),
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
    moveSidebarItems.mockResolvedValue(
      moveResult({ affectedItemIds: [folder._id], movedSourceItemIds: [folder._id] }),
    )
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
    moveSidebarItems.mockResolvedValue(
      moveResult({ affectedItemIds: [folder._id], restoredSourceItemIds: [folder._id] }),
    )
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
    moveSidebarItems.mockResolvedValue(
      moveResult({ affectedItemIds: [trashed._id], restoredSourceItemIds: [trashed._id] }),
    )

    const { result } = renderHook(() => useSidebarItemOperationsValue())
    await act(async () => {
      await result.current.restoreItems([trashed])
    })

    expect(moveSidebarItems).not.toHaveBeenCalled()

    render(result.current.dialog)
    expect(screen.getByRole('heading', { name: 'Resolve File Conflict' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Use incoming Meeting Notes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use existing Meeting Notes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply selected conflict choices' }))

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
    const createdId = testId<'sidebarItems'>('copy_1')
    duplicateSidebarItems.mockResolvedValue(
      duplicateResult({
        createdItemIds: [createdId],
        createdRootItemIds: [createdId],
        copiedSourceItemIds: [folder._id],
      }),
    )

    const { result } = renderHook(() => useSidebarItemOperationsValue())
    await act(async () => {
      await result.current.duplicateItems([folder, child], target._id)
    })

    expect(duplicateSidebarItems).toHaveBeenCalledWith({
      sourceItemIds: [folder._id],
      targetParentId: target._id,
      decisions: undefined,
    })
    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([createdId])
  })

  it('counts only created roots in duplicate conflict feedback', async () => {
    const target = createFolder({ name: 'Target' })
    const first = createNote({ name: 'Scene A' })
    const second = createNote({ name: 'Scene B' })
    const existingFirst = createNote({ name: 'Scene A', parentId: target._id })
    const existingSecond = createNote({ name: 'Scene B', parentId: target._id })
    const createdId = testId<'sidebarItems'>('copy_1')
    sidebarItems = [target, first, second, existingFirst, existingSecond]
    duplicateSidebarItems.mockResolvedValue(
      duplicateResult({
        createdItemIds: [createdId],
        createdRootItemIds: [createdId],
        replacedSourceItemIds: [first._id],
        skippedSourceItemIds: [second._id],
      }),
    )

    const { result } = renderHook(() => useSidebarItemOperationsValue())
    await act(async () => {
      await result.current.duplicateItems([first, second], target._id)
    })

    render(result.current.dialog)
    fireEvent.click(screen.getByRole('button', { name: 'Decide for each item' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use incoming Scene A' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use existing Scene B' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply selected conflict choices' }))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Item copied')
    })
    expect(toast.success).not.toHaveBeenCalledWith('2 items copied')
    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([createdId])
  })

  it('clears a cut clipboard without moving when pasting every item into its current parent', async () => {
    const folder = createFolder({ name: 'Folder' })
    const first = createNote({ name: 'First', parentId: folder._id })
    const second = createNote({ name: 'Second', parentId: folder._id })
    sidebarItems = [folder, first, second]
    useSidebarUIStore.getState().setActiveItemSurface({
      surface: 'folder-view',
      parentId: folder._id,
      visibleItemIds: [first._id, second._id],
    })
    useSidebarUIStore.getState().setSelectedItemIds([first._id, second._id], first._id)
    useSidebarUIStore.getState().setItemClipboard({
      mode: 'cut',
      campaignId: testId<'campaigns'>('campaign_1'),
      itemIds: [first._id, second._id],
    })

    const { result } = renderHook(() => useSidebarItemOperationsValue())
    await act(async () => {
      await result.current.pasteClipboard(folder._id)
    })

    expect(moveSidebarItems).not.toHaveBeenCalled()
    expect(useSidebarUIStore.getState().itemClipboard).toBeNull()
    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([first._id, second._id])
    expect(useSidebarUIStore.getState().anchorItemId).toBe(first._id)
  })

  it('keeps copy and cut selection unchanged while updating the clipboard', () => {
    const first = createNote({ name: 'First' })
    const second = createNote({ name: 'Second' })
    sidebarItems = [first, second]
    useSidebarUIStore.getState().setSelectedItemIds([first._id, second._id], first._id)

    const { result } = renderHook(() => useSidebarItemOperationsValue())

    act(() => {
      result.current.copyItems([first, second])
    })
    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([first._id, second._id])
    expect(useSidebarUIStore.getState().itemClipboard).toEqual({
      mode: 'copy',
      campaignId: testId<'campaigns'>('campaign_1'),
      itemIds: [first._id, second._id],
    })

    act(() => {
      result.current.cutItems([first, second])
    })
    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([first._id, second._id])
    expect(useSidebarUIStore.getState().itemClipboard).toEqual({
      mode: 'cut',
      campaignId: testId<'campaigns'>('campaign_1'),
      itemIds: [first._id, second._id],
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
    permanentlyDeleteSidebarItems.mockResolvedValue(permanentDeleteResult([folder._id]))

    const { result } = renderHook(() => useSidebarItemOperationsValue())
    await act(async () => {
      await result.current.permanentlyDeleteItems([folder, child])
    })

    expect(permanentlyDeleteSidebarItems).toHaveBeenCalledWith({
      sourceItemIds: [folder._id],
    })
  })

  it('removes trashed item roots and their selected descendants from selection', async () => {
    const folder = createFolder({ name: 'Folder' })
    const child = createNote({ name: 'Child', parentId: folder._id })
    const unrelated = createNote({ name: 'Unrelated' })
    sidebarItems = [folder, child, unrelated]
    moveSidebarItems.mockResolvedValue(
      moveResult({ affectedItemIds: [folder._id], trashedSourceItemIds: [folder._id] }),
    )
    useSidebarUIStore.getState().setActiveItemSurface({
      surface: 'sidebar',
      parentId: null,
      visibleItemIds: [folder._id, child._id, unrelated._id],
    })
    useSidebarUIStore
      .getState()
      .setSelectedItemIds([folder._id, child._id, unrelated._id], folder._id)

    const { result } = renderHook(() => useSidebarItemOperationsValue())
    await act(async () => {
      await result.current.trashItems([folder, child])
    })

    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([unrelated._id])
    expect(useSidebarUIStore.getState().anchorItemId).toBe(unrelated._id)
  })

  it('removes permanently deleted trash roots and descendants from selection', async () => {
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
    const unrelated = createNote({
      name: 'Unrelated',
      location: SIDEBAR_ITEM_LOCATION.trash,
      parentId: null,
    })
    trashItems = [folder, child, unrelated]
    permanentlyDeleteSidebarItems.mockResolvedValue(permanentDeleteResult([folder._id]))
    useSidebarUIStore
      .getState()
      .setSelectedItemIds([folder._id, child._id, unrelated._id], folder._id)

    const { result } = renderHook(() => useSidebarItemOperationsValue())
    await act(async () => {
      await result.current.permanentlyDeleteItems([folder, child])
    })

    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([unrelated._id])
    expect(useSidebarUIStore.getState().anchorItemId).toBe(unrelated._id)
  })
})
