import { beforeEach, describe, expect, it } from 'vitest'
import { assertSidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import {
  useCampaignSidebarActions,
  useSidebarUIStore,
} from '~/features/sidebar/stores/sidebar-ui-store'
import { resetSidebarUIStore } from '~/test/helpers/store-helpers'
import { testId } from '~/test/helpers/test-id'

const campaignId = 'campaign_1'

beforeEach(() => {
  resetSidebarUIStore()
})

describe('folder states', () => {
  it('setFolderState opens a folder', () => {
    useSidebarUIStore.getState().setFolderState(campaignId, 'folder_1', true)
    const state = useSidebarUIStore.getState().campaignStates[campaignId]
    expect(state.folderStates['folder_1']).toBe(true)
  })

  it('setFolderState closes a folder', () => {
    useSidebarUIStore.getState().setFolderState(campaignId, 'folder_1', true)
    useSidebarUIStore.getState().setFolderState(campaignId, 'folder_1', false)
    const state = useSidebarUIStore.getState().campaignStates[campaignId]
    expect(state.folderStates['folder_1']).toBe(false)
  })

  it('toggleFolderState toggles between open and closed', () => {
    useSidebarUIStore.getState().toggleFolderState(campaignId, 'folder_1')
    expect(useSidebarUIStore.getState().campaignStates[campaignId].folderStates['folder_1']).toBe(
      true,
    )

    useSidebarUIStore.getState().toggleFolderState(campaignId, 'folder_1')
    expect(useSidebarUIStore.getState().campaignStates[campaignId].folderStates['folder_1']).toBe(
      false,
    )
  })

  it('clearAllFolderStates resets all folders for a campaign', () => {
    useSidebarUIStore.getState().setFolderState(campaignId, 'folder_1', true)
    useSidebarUIStore.getState().setFolderState(campaignId, 'folder_2', true)
    useSidebarUIStore.getState().clearAllFolderStates(campaignId)
    const state = useSidebarUIStore.getState().campaignStates[campaignId]
    expect(state.folderStates).toEqual({})
  })

  it('folder states are isolated per campaign', () => {
    useSidebarUIStore.getState().setFolderState(campaignId, 'folder_1', true)
    useSidebarUIStore.getState().setFolderState('campaign_2', 'folder_1', false)
    expect(useSidebarUIStore.getState().campaignStates[campaignId].folderStates['folder_1']).toBe(
      true,
    )
    expect(useSidebarUIStore.getState().campaignStates['campaign_2'].folderStates['folder_1']).toBe(
      false,
    )
  })
})

describe('closeAllFoldersMode', () => {
  it('toggleCloseAllFoldersMode toggles the mode', () => {
    useSidebarUIStore.getState().toggleCloseAllFoldersMode(campaignId)
    expect(useSidebarUIStore.getState().campaignStates[campaignId].closeAllFoldersMode).toBe(true)

    useSidebarUIStore.getState().toggleCloseAllFoldersMode(campaignId)
    expect(useSidebarUIStore.getState().campaignStates[campaignId].closeAllFoldersMode).toBe(false)
  })

  it('exitCloseAllMode sets mode to false', () => {
    useSidebarUIStore.getState().toggleCloseAllFoldersMode(campaignId)
    useSidebarUIStore.getState().exitCloseAllMode(campaignId)
    expect(useSidebarUIStore.getState().campaignStates[campaignId].closeAllFoldersMode).toBe(false)
  })
})

describe('bookmarksOnlyMode', () => {
  it('toggleBookmarksOnlyMode toggles the mode', () => {
    useSidebarUIStore.getState().toggleBookmarksOnlyMode(campaignId)
    expect(useSidebarUIStore.getState().campaignStates[campaignId].bookmarksOnlyMode).toBe(true)

    useSidebarUIStore.getState().toggleBookmarksOnlyMode(campaignId)
    expect(useSidebarUIStore.getState().campaignStates[campaignId].bookmarksOnlyMode).toBe(false)
  })
})

describe('selection', () => {
  it('setSelected updates selectedSlug', () => {
    useSidebarUIStore.getState().setSelected(assertSidebarItemSlug('my-note'))
    expect(useSidebarUIStore.getState().selectedSlug).toBe('my-note')
  })

  it('setSelected no-ops for same slug', () => {
    const slug = assertSidebarItemSlug('my-note')
    useSidebarUIStore.getState().setSelected(slug)
    const stateBefore = useSidebarUIStore.getState()
    useSidebarUIStore.getState().setSelected(slug)
    const stateAfter = useSidebarUIStore.getState()
    expect(stateBefore).toBe(stateAfter)
  })

  it('setSelected to null clears selection', () => {
    useSidebarUIStore.getState().setSelected(assertSidebarItemSlug('my-note'))
    useSidebarUIStore.getState().setSelected(null)
    expect(useSidebarUIStore.getState().selectedSlug).toBeNull()
  })

  it('selectSingleItem stores one selected item and anchor without changing selectedSlug', () => {
    const noteId = testId<'sidebarItems'>('note_1')
    useSidebarUIStore.getState().setSelected(assertSidebarItemSlug('open-note'))

    useSidebarUIStore.getState().selectSingleItem(noteId)

    expect(useSidebarUIStore.getState().selectedSlug).toBe('open-note')
    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([noteId])
    expect(useSidebarUIStore.getState().anchorItemId).toBe(noteId)
    expect(useSidebarUIStore.getState().focusedItemId).toBe(noteId)
  })

  it('toggleItemSelection adds and removes one item while preserving the anchor', () => {
    const noteId = testId<'sidebarItems'>('note_1')
    const mapId = testId<'sidebarItems'>('map_1')

    useSidebarUIStore.getState().selectSingleItem(noteId)
    useSidebarUIStore.getState().toggleItemSelection(mapId)

    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([noteId, mapId])
    expect(useSidebarUIStore.getState().anchorItemId).toBe(noteId)

    useSidebarUIStore.getState().toggleItemSelection(noteId)

    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([mapId])
    expect(useSidebarUIStore.getState().anchorItemId).toBe(mapId)
  })

  it('selectItemRange selects visible ids between the anchor and target', () => {
    const a = testId<'sidebarItems'>('item_a')
    const b = testId<'sidebarItems'>('item_b')
    const c = testId<'sidebarItems'>('item_c')
    const d = testId<'sidebarItems'>('item_d')

    useSidebarUIStore.getState().selectSingleItem(b)
    useSidebarUIStore.getState().selectItemRange(d, [a, b, c, d])

    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([b, c, d])
    expect(useSidebarUIStore.getState().anchorItemId).toBe(b)
    expect(useSidebarUIStore.getState().focusedItemId).toBe(d)
  })

  it('moves focus down and selects the focused item', () => {
    const a = testId<'sidebarItems'>('item_a')
    const b = testId<'sidebarItems'>('item_b')

    useSidebarUIStore.getState().moveFocus('down', [a, b], false)

    expect(useSidebarUIStore.getState().focusedItemId).toBe(a)
    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([a])

    useSidebarUIStore.getState().moveFocus('down', [a, b], false)

    expect(useSidebarUIStore.getState().focusedItemId).toBe(b)
    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([b])
  })

  it('shift focus movement extends selection from the anchor', () => {
    const a = testId<'sidebarItems'>('item_a')
    const b = testId<'sidebarItems'>('item_b')
    const c = testId<'sidebarItems'>('item_c')

    useSidebarUIStore.getState().selectSingleItem(a)
    useSidebarUIStore.getState().moveFocus('down', [a, b, c], true)
    useSidebarUIStore.getState().moveFocus('down', [a, b, c], true)

    expect(useSidebarUIStore.getState().focusedItemId).toBe(c)
    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([a, b, c])
    expect(useSidebarUIStore.getState().anchorItemId).toBe(a)
  })

  it('clearItemSelection leaves keyboard focus in place', () => {
    const noteId = testId<'sidebarItems'>('note_1')

    useSidebarUIStore.getState().selectSingleItem(noteId)
    useSidebarUIStore.getState().clearItemSelection()

    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([])
    expect(useSidebarUIStore.getState().focusedItemId).toBe(noteId)
  })

  it('normalizeContextSelection preserves a group when right-clicking a selected item', () => {
    const noteId = testId<'sidebarItems'>('note_1')
    const mapId = testId<'sidebarItems'>('map_1')

    useSidebarUIStore.getState().setSelectedItemIds([noteId, mapId], noteId)
    useSidebarUIStore.getState().normalizeContextSelection(mapId, [noteId, mapId])

    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([noteId, mapId])
    expect(useSidebarUIStore.getState().anchorItemId).toBe(noteId)
  })

  it('normalizeContextSelection replaces a selected group that does not belong to the surface', () => {
    const noteId = testId<'sidebarItems'>('note_1')
    const mapId = testId<'sidebarItems'>('map_1')

    useSidebarUIStore.getState().setSelectedItemIds([noteId, mapId], noteId)
    useSidebarUIStore.getState().normalizeContextSelection(mapId, [mapId])

    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([mapId])
    expect(useSidebarUIStore.getState().anchorItemId).toBe(mapId)
  })

  it('normalizeContextSelection selects only an unselected right-click target', () => {
    const noteId = testId<'sidebarItems'>('note_1')
    const mapId = testId<'sidebarItems'>('map_1')
    const fileId = testId<'sidebarItems'>('file_1')

    useSidebarUIStore.getState().setSelectedItemIds([noteId, mapId], noteId)
    useSidebarUIStore.getState().normalizeContextSelection(fileId, [noteId, mapId, fileId])

    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([fileId])
    expect(useSidebarUIStore.getState().anchorItemId).toBe(fileId)
  })

  it('tracks active item surface context for scoped hotkeys and paste targets', () => {
    const folderId = testId<'sidebarItems'>('folder_1')

    useSidebarUIStore.getState().setActiveItemSurface({
      surface: 'folder-view',
      parentId: folderId,
      visibleItemIds: [testId<'sidebarItems'>('note_1')],
    })

    expect(useSidebarUIStore.getState().activeItemSurface).toEqual({
      surface: 'folder-view',
      parentId: folderId,
      visibleItemIds: [testId<'sidebarItems'>('note_1')],
    })
  })

  it('preserves item selection when the active surface changes but selected ids are visible', () => {
    const folderId = testId<'sidebarItems'>('folder_1')
    const noteId = testId<'sidebarItems'>('note_1')

    useSidebarUIStore.getState().setActiveItemSurface({
      surface: 'sidebar',
      parentId: null,
      visibleItemIds: [noteId],
    })
    useSidebarUIStore.getState().setSelectedItemIds([noteId], noteId)
    useSidebarUIStore.getState().setActiveItemSurface({
      surface: 'folder-view',
      parentId: folderId,
      visibleItemIds: [noteId],
    })

    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([noteId])
    expect(useSidebarUIStore.getState().anchorItemId).toBe(noteId)
    expect(useSidebarUIStore.getState().focusedItemId).toBe(noteId)
  })

  it('clears item selection when a different active surface cannot see the selected ids', () => {
    const folderId = testId<'sidebarItems'>('folder_1')
    const noteId = testId<'sidebarItems'>('note_1')

    useSidebarUIStore.getState().setActiveItemSurface({
      surface: 'sidebar',
      parentId: null,
      visibleItemIds: [noteId],
    })
    useSidebarUIStore.getState().setSelectedItemIds([noteId], noteId)
    useSidebarUIStore.getState().setActiveItemSurface({
      surface: 'folder-view',
      parentId: folderId,
      visibleItemIds: [],
    })

    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([])
    expect(useSidebarUIStore.getState().anchorItemId).toBeNull()
    expect(useSidebarUIStore.getState().focusedItemId).toBeNull()
    expect(useSidebarUIStore.getState().selectionSurface).toBeNull()
  })

  it('preserves item selection when the same surface updates after selected items move away', () => {
    const noteId = testId<'sidebarItems'>('note_1')
    const mapId = testId<'sidebarItems'>('map_1')
    const folderId = testId<'sidebarItems'>('folder_1')

    useSidebarUIStore.getState().setActiveItemSurface({
      surface: 'sidebar',
      parentId: null,
      visibleItemIds: [noteId, mapId, folderId],
    })
    useSidebarUIStore.getState().setSelectedItemIds([noteId, mapId], noteId)
    useSidebarUIStore.getState().setActiveItemSurface({
      surface: 'sidebar',
      parentId: null,
      visibleItemIds: [folderId],
    })

    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([noteId, mapId])
    expect(useSidebarUIStore.getState().anchorItemId).toBe(noteId)
    expect(useSidebarUIStore.getState().focusedItemId).toBeNull()
  })

  it('clears item selection when the active surface unregisters', () => {
    const noteId = testId<'sidebarItems'>('note_1')
    const mapId = testId<'sidebarItems'>('map_1')

    useSidebarUIStore.getState().setActiveItemSurface({
      surface: 'sidebar',
      parentId: null,
      visibleItemIds: [noteId, mapId],
    })
    useSidebarUIStore.getState().setSelectedItemIds([noteId, mapId], noteId)
    useSidebarUIStore.getState().setActiveItemSurface(null)

    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([])
    expect(useSidebarUIStore.getState().anchorItemId).toBeNull()
    expect(useSidebarUIStore.getState().activeItemSurface).toBeNull()
    expect(useSidebarUIStore.getState().selectionSurface).toBeNull()
  })

  it('setSelected preserves item-id selections when route selection changes', () => {
    const noteId = testId<'sidebarItems'>('note_1')

    useSidebarUIStore.getState().setSelectedItemIds([noteId], noteId)
    useSidebarUIStore.getState().setSelected(assertSidebarItemSlug('other-note'))

    expect(useSidebarUIStore.getState().selectedSlug).toBe('other-note')
    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([noteId])
    expect(useSidebarUIStore.getState().anchorItemId).toBe(noteId)
  })

  it('preserves a plain-click anchor across route sync for the next shift-click range', () => {
    const a = testId<'sidebarItems'>('item_a')
    const b = testId<'sidebarItems'>('item_b')
    const c = testId<'sidebarItems'>('item_c')

    useSidebarUIStore.getState().selectSingleItem(a)
    useSidebarUIStore.getState().setSelected(assertSidebarItemSlug('item-a'))
    useSidebarUIStore.getState().selectItemRange(c, [a, b, c])

    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([a, b, c])
    expect(useSidebarUIStore.getState().anchorItemId).toBe(a)
  })

  it('clearSelectionForCampaignChange clears selection and item clipboard', () => {
    useSidebarUIStore
      .getState()
      .setSelectedItemIds([testId<'sidebarItems'>('note_1')], testId<'sidebarItems'>('note_1'))
    useSidebarUIStore.getState().setItemClipboard({
      mode: 'copy',
      campaignId: testId<'campaigns'>('campaign_1'),
      itemIds: [testId<'sidebarItems'>('note_1')],
    })

    useSidebarUIStore.getState().clearSelectionForCampaignChange()

    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([])
    expect(useSidebarUIStore.getState().anchorItemId).toBeNull()
    expect(useSidebarUIStore.getState().itemClipboard).toBeNull()
  })
})

describe('renaming', () => {
  it('setRenamingId and setPendingItemName update state', () => {
    useSidebarUIStore.getState().setRenamingId(testId<'sidebarItems'>('note_1'))
    useSidebarUIStore.getState().setPendingItemName('New Name')
    expect(useSidebarUIStore.getState().renamingId).toBe('note_1')
    expect(useSidebarUIStore.getState().pendingItemName).toBe('New Name')
  })
})

describe('viewAsPlayerId', () => {
  it('sets and clears viewAsPlayerId', () => {
    const playerId = testId<'campaignMembers'>('member_view')
    useSidebarUIStore.getState().setViewAsPlayerId(playerId)
    expect(useSidebarUIStore.getState().viewAsPlayerId).toBe(playerId)

    useSidebarUIStore.getState().setViewAsPlayerId(null)
    expect(useSidebarUIStore.getState().viewAsPlayerId).toBeNull()
  })
})

describe('useCampaignSidebarActions', () => {
  it('returns noop functions when campaignId is undefined', () => {
    const actions = useCampaignSidebarActions(undefined)
    actions.setFolderState('folder_1', true)
    actions.toggleFolderState('folder_1')
    actions.clearAllFolderStates()
    actions.toggleCloseAllFoldersMode()
    actions.exitCloseAllMode()
    actions.toggleBookmarksOnlyMode()
    expect(useSidebarUIStore.getState().campaignStates).toEqual({})
  })

  it('returns working functions when campaignId is provided', () => {
    const actions = useCampaignSidebarActions(campaignId)
    actions.setFolderState('folder_1', true)
    expect(useSidebarUIStore.getState().campaignStates[campaignId].folderStates['folder_1']).toBe(
      true,
    )
  })
})
