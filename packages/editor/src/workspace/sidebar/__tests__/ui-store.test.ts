import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { DEFAULT_SORT_OPTIONS } from '../../items-persistence-contract'
import { testId } from '../../../test/id'
import {
  useRuntimeSidebarWorkspaceState,
  useRuntimeSidebarWorkspaceStateWithSort,
} from '../workspace-state'
import { createSidebarWorkspaceStateHarness } from './test-helpers'

const workspaceId = 'workspace_1'

describe('folder states', () => {
  it('setFolderState opens a folder', () => {
    const sidebar = createSidebarWorkspaceStateHarness({ workspaceId })
    const folderId = testId<'sidebarItems'>('folder_1')

    act(() => {
      sidebar.current.uiCommands.setFolderState(folderId, true)
    })

    expect(sidebar.current.ui.folderStates[folderId]).toBe(true)
  })

  it('toggleFolderState opens a closed folder', () => {
    const sidebar = createSidebarWorkspaceStateHarness({ workspaceId })
    const folderId = testId<'sidebarItems'>('folder_1')

    act(() => {
      sidebar.current.uiCommands.toggleFolderState(folderId)
    })

    expect(sidebar.current.ui.folderStates[folderId]).toBe(true)
  })

  it('folder states are isolated per workspace', () => {
    const firstWorkspace = createSidebarWorkspaceStateHarness({ workspaceId: 'workspace_1' })
    const secondWorkspace = createSidebarWorkspaceStateHarness({ workspaceId: 'workspace_2' })
    const folderId = testId<'sidebarItems'>('folder_1')

    act(() => {
      firstWorkspace.current.uiCommands.setFolderState(folderId, true)
      secondWorkspace.current.uiCommands.setFolderState(folderId, true)
      secondWorkspace.current.uiCommands.setFolderState(folderId, false)
    })

    expect(firstWorkspace.current.ui.folderStates[folderId]).toBe(true)

    act(() => {
      secondWorkspace.current.uiCommands.toggleFolderState(folderId)
    })

    expect(secondWorkspace.current.ui.folderStates[folderId]).toBe(true)
  })
})

describe('closeAllFoldersMode', () => {
  it('toggleCloseAllFoldersMode preserves persisted folder state', () => {
    const sidebar = createSidebarWorkspaceStateHarness({ workspaceId })
    const firstFolderId = testId<'sidebarItems'>('folder_1')
    const secondFolderId = testId<'sidebarItems'>('folder_2')

    act(() => {
      sidebar.current.uiCommands.setFolderState(firstFolderId, true)
      sidebar.current.uiCommands.setFolderState(secondFolderId, true)
      sidebar.current.uiCommands.toggleCloseAllFoldersMode()
    })

    expect(sidebar.current.ui.closeAllFoldersMode).toBe(true)
    expect(sidebar.current.ui.folderStates).toEqual({
      [firstFolderId]: true,
      [secondFolderId]: true,
    })

    act(() => {
      sidebar.current.uiCommands.exitCloseAllMode()
    })

    expect(sidebar.current.ui.closeAllFoldersMode).toBe(false)
    expect(sidebar.current.ui.folderStates).toEqual({
      [firstFolderId]: true,
      [secondFolderId]: true,
    })
  })
})

describe('bookmarksOnlyMode', () => {
  it('toggleBookmarksOnlyMode enables the mode', () => {
    const sidebar = createSidebarWorkspaceStateHarness({ workspaceId })

    act(() => {
      sidebar.current.uiCommands.toggleBookmarksOnlyMode()
    })

    expect(sidebar.current.ui.bookmarksOnlyMode).toBe(true)
  })
})

describe('selection', () => {
  it('selectSingleItem stores one selected and focused item', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const noteId = testId<'sidebarItems'>('note_1')

    act(() => {
      sidebar.current.selectionCommands.selectSingleItem(noteId)
    })

    expect(sidebar.current.selection.selectedItemIds).toEqual([noteId])
    expect(sidebar.current.selection.focusedItemId).toBe(noteId)
  })

  it('isolates selection, focus, active surface, and rename state per workspace', () => {
    const firstWorkspace = createSidebarWorkspaceStateHarness({ workspaceId: 'workspace_a' })
    const secondWorkspace = createSidebarWorkspaceStateHarness({ workspaceId: 'workspace_b' })
    const firstNoteId = testId<'sidebarItems'>('note_a')
    const secondNoteId = testId<'sidebarItems'>('note_b')

    act(() => {
      firstWorkspace.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [firstNoteId],
      })
      firstWorkspace.current.selectionCommands.selectSingleItem(firstNoteId)
      firstWorkspace.current.editing.setRenamingItemId(firstNoteId)

      secondWorkspace.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [secondNoteId],
      })
      secondWorkspace.current.selectionCommands.selectSingleItem(secondNoteId)
      secondWorkspace.current.editing.setRenamingItemId(secondNoteId)
    })

    expect(firstWorkspace.current.selection.selectedItemIds).toEqual([firstNoteId])
    expect(firstWorkspace.current.selection.focusedItemId).toBe(firstNoteId)
    expect(firstWorkspace.current.editing.renamingItemId).toBe(firstNoteId)
    expect(secondWorkspace.current.selection.selectedItemIds).toEqual([secondNoteId])
    expect(secondWorkspace.current.selection.focusedItemId).toBe(secondNoteId)
    expect(secondWorkspace.current.editing.renamingItemId).toBe(secondNoteId)
  })

  it('toggleItemSelection adds and removes one item', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const noteId = testId<'sidebarItems'>('note_1')
    const mapId = testId<'sidebarItems'>('map_1')

    act(() => {
      sidebar.current.selectionCommands.selectSingleItem(noteId)
      sidebar.current.selectionCommands.toggleItemSelection(mapId)
    })

    expect(sidebar.current.selection.selectedItemIds).toEqual([noteId, mapId])

    act(() => {
      sidebar.current.selectionCommands.toggleItemSelection(noteId)
    })

    expect(sidebar.current.selection.selectedItemIds).toEqual([mapId])
    expect(sidebar.current.selection.focusedItemId).toBe(noteId)
  })

  it('selectItemRange selects visible ids between the anchor and target', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const a = testId<'sidebarItems'>('item_a')
    const b = testId<'sidebarItems'>('item_b')
    const c = testId<'sidebarItems'>('item_c')
    const d = testId<'sidebarItems'>('item_d')

    act(() => {
      sidebar.current.selectionCommands.selectSingleItem(b)
      sidebar.current.selectionCommands.selectItemRange(d, [a, b, c, d])
    })

    expect(sidebar.current.selection.selectedItemIds).toEqual([b, c, d])
    expect(sidebar.current.selection.focusedItemId).toBe(d)
  })

  it('moves focus down and selects the focused item', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const a = testId<'sidebarItems'>('item_a')
    const b = testId<'sidebarItems'>('item_b')

    act(() => {
      sidebar.current.selectionCommands.moveFocus('down', [a, b], false)
    })

    expect(sidebar.current.selection.focusedItemId).toBe(a)
    expect(sidebar.current.selection.selectedItemIds).toEqual([a])

    act(() => {
      sidebar.current.selectionCommands.moveFocus('down', [a, b], false)
    })

    expect(sidebar.current.selection.focusedItemId).toBe(b)
    expect(sidebar.current.selection.selectedItemIds).toEqual([b])
  })

  it('shift focus movement extends selection from the anchor', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const a = testId<'sidebarItems'>('item_a')
    const b = testId<'sidebarItems'>('item_b')
    const c = testId<'sidebarItems'>('item_c')

    act(() => {
      sidebar.current.selectionCommands.selectSingleItem(a)
      sidebar.current.selectionCommands.moveFocus('down', [a, b, c], true)
      sidebar.current.selectionCommands.moveFocus('down', [a, b, c], true)
    })

    expect(sidebar.current.selection.focusedItemId).toBe(c)
    expect(sidebar.current.selection.selectedItemIds).toEqual([a, b, c])
  })

  it('shift focus movement extends from the visible focus when the stored anchor is hidden', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const hidden = testId<'sidebarItems'>('hidden_item')
    const a = testId<'sidebarItems'>('item_a')
    const b = testId<'sidebarItems'>('item_b')
    const c = testId<'sidebarItems'>('item_c')

    act(() => {
      sidebar.current.selectionCommands.setSelectedItemIds([hidden], hidden)
      sidebar.current.selectionCommands.setFocusedItem(a)
      sidebar.current.selectionCommands.moveFocus('down', [a, b, c], true)
      sidebar.current.selectionCommands.moveFocus('down', [a, b, c], true)
    })

    expect(sidebar.current.selection.focusedItemId).toBe(c)
    expect(sidebar.current.selectionCommands.getSelectionSnapshot().anchorItemId).toBe(a)
    expect(sidebar.current.selection.selectedItemIds).toEqual([a, b, c])
  })

  it('normalizeContextSelection preserves a group when right-clicking a selected item', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const noteId = testId<'sidebarItems'>('note_1')
    const mapId = testId<'sidebarItems'>('map_1')

    act(() => {
      sidebar.current.selectionCommands.setSelectedItemIds([noteId, mapId], noteId)
      sidebar.current.selectionCommands.normalizeContextSelection(mapId, [noteId, mapId])
    })

    expect(sidebar.current.selection.selectedItemIds).toEqual([noteId, mapId])
  })

  it('allows callers to clear the selection anchor while preserving selected items', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const noteId = testId<'sidebarItems'>('note_1')
    const mapId = testId<'sidebarItems'>('map_1')

    act(() => {
      sidebar.current.selectionCommands.setSelectedItemIds([noteId, mapId], null)
    })

    expect(sidebar.current.selection.selectedItemIds).toEqual([noteId, mapId])
    expect(sidebar.current.selectionCommands.getSelectionSnapshot().anchorItemId).toBeNull()
    expect(sidebar.current.selection.focusedItemId).toBeNull()
  })

  it('normalizeContextSelection scopes the selected group to the context surface', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const noteId = testId<'sidebarItems'>('note_1')
    const mapId = testId<'sidebarItems'>('map_1')

    act(() => {
      sidebar.current.selectionCommands.setSelectedItemIds([noteId, mapId], noteId)
      sidebar.current.selectionCommands.normalizeContextSelection(mapId, [mapId])
    })

    expect(sidebar.current.selection.selectedItemIds).toEqual([mapId])
  })

  it('normalizeContextSelection selects only an unselected right-click target', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const noteId = testId<'sidebarItems'>('note_1')
    const mapId = testId<'sidebarItems'>('map_1')
    const fileId = testId<'sidebarItems'>('file_1')

    act(() => {
      sidebar.current.selectionCommands.setSelectedItemIds([noteId, mapId], noteId)
      sidebar.current.selectionCommands.normalizeContextSelection(fileId, [noteId, mapId, fileId])
    })

    expect(sidebar.current.selection.selectedItemIds).toEqual([fileId])
    expect(sidebar.current.selection.focusedItemId).toBe(fileId)
  })

  it('tracks active item surface context for scoped hotkeys and paste targets', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const folderId = testId<'sidebarItems'>('folder_1')
    const noteId = testId<'sidebarItems'>('note_1')

    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'folder-view',
        parentId: folderId,
        visibleItemIds: [noteId],
      })
    })

    expect(sidebar.current.selection.activeItemSurface).toEqual({
      surface: 'folder-view',
      parentId: folderId,
      visibleItemIds: [noteId],
    })
  })

  it('keeps selection snapshots detached from stored selection state', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const folderId = testId<'sidebarItems'>('folder_1')
    const noteId = testId<'sidebarItems'>('note_1')
    const mapId = testId<'sidebarItems'>('map_1')
    const leakedSelection = testId<'sidebarItems'>('leaked_selection')
    const leakedVisibleItem = testId<'sidebarItems'>('leaked_visible_item')
    const visibleItemIds = [noteId, mapId]

    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'folder-view',
        parentId: folderId,
        visibleItemIds,
      })
      sidebar.current.selectionCommands.setSelectedItemIds([noteId], noteId)
    })

    ;(visibleItemIds as Array<unknown>).push(leakedVisibleItem)
    const snapshot = sidebar.current.selectionCommands.getSelectionSnapshot()
    const snapshotSurface = snapshot.activeItemSurface
    if (!snapshotSurface) throw new Error('Expected the selection snapshot to include a surface')
    ;(snapshot.selectedItemIds as Array<unknown>).push(leakedSelection)
    ;(snapshotSurface.visibleItemIds as Array<unknown>).push(leakedVisibleItem)

    expect(sidebar.current.selection.selectedItemIds).toEqual([noteId])
    expect(sidebar.current.selection.activeItemSurface?.visibleItemIds).toEqual([noteId, mapId])
  })

  it('preserves item selection when the active surface changes but selected ids are visible', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const folderId = testId<'sidebarItems'>('folder_1')
    const noteId = testId<'sidebarItems'>('note_1')

    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [noteId],
      })
      sidebar.current.selectionCommands.setSelectedItemIds([noteId], noteId)
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'folder-view',
        parentId: folderId,
        visibleItemIds: [noteId],
      })
    })

    expect(sidebar.current.selection.selectedItemIds).toEqual([noteId])
    expect(sidebar.current.selection.focusedItemId).toBe(noteId)
  })

  it('clears item selection when a different active surface cannot see the selected ids', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const folderId = testId<'sidebarItems'>('folder_1')
    const noteId = testId<'sidebarItems'>('note_1')

    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [noteId],
      })
      sidebar.current.selectionCommands.setSelectedItemIds([noteId], noteId)
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'folder-view',
        parentId: folderId,
        visibleItemIds: [],
      })
    })

    expect(sidebar.current.selection.selectedItemIds).toEqual([])
    expect(sidebar.current.selection.focusedItemId).toBeNull()
    expect(sidebar.current.selectionCommands.getSelectionSnapshot().anchorItemId).toBeNull()
  })

  it('preserves item selection when the active surface transiently unregisters', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const noteId = testId<'sidebarItems'>('note_1')
    const mapId = testId<'sidebarItems'>('map_1')

    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [noteId, mapId],
      })
      sidebar.current.selectionCommands.setSelectedItemIds([noteId, mapId], noteId)
      sidebar.current.selectionCommands.setActiveItemSurface(null)
    })

    expect(sidebar.current.selection.selectedItemIds).toEqual([noteId, mapId])
  })

  it('clears transient item selection when the next active surface cannot see it', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const noteId = testId<'sidebarItems'>('note_1')
    const folderViewSurface = {
      surface: 'folder-view' as const,
      parentId: testId<'sidebarItems'>('folder_1'),
      visibleItemIds: [],
    }

    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [noteId],
      })
      sidebar.current.selectionCommands.setSelectedItemIds([noteId], noteId)
      sidebar.current.selectionCommands.setActiveItemSurface(null)
      sidebar.current.selectionCommands.setActiveItemSurface(folderViewSurface)
    })

    expect(sidebar.current.selection.selectedItemIds).toEqual([])
    expect(sidebar.current.selection.activeItemSurface).toEqual(folderViewSurface)
  })

  it('preserves a plain-click anchor for the next shift-click range', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const a = testId<'sidebarItems'>('item_a')
    const b = testId<'sidebarItems'>('item_b')
    const c = testId<'sidebarItems'>('item_c')

    act(() => {
      sidebar.current.selectionCommands.selectSingleItem(a)
      sidebar.current.selectionCommands.selectItemRange(c, [a, b, c])
    })

    expect(sidebar.current.selection.selectedItemIds).toEqual([a, b, c])
  })

  it('clears selection, focus, active surface, and rename state for workspace changes', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const noteId = testId<'sidebarItems'>('note_1')
    const mapId = testId<'sidebarItems'>('map_1')

    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [noteId, mapId],
      })
      sidebar.current.selectionCommands.setSelectedItemIds([noteId], noteId)
      sidebar.current.editing.setRenamingItemId(noteId)
      sidebar.current.selectionCommands.clearSelectionForWorkspaceChange()
    })

    expect(sidebar.current.selection.selectedItemIds).toEqual([])
    expect(sidebar.current.selection.focusedItemId).toBeNull()
    expect(sidebar.current.selection.activeItemSurface).toBeNull()
    expect(sidebar.current.editing.renamingItemId).toBeNull()
  })
})

describe('renaming', () => {
  it('setRenamingId updates state', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const noteId = testId<'sidebarItems'>('note_1')

    act(() => {
      sidebar.current.editing.setRenamingItemId(noteId)
    })

    expect(sidebar.current.editing.renamingItemId).toBe(noteId)
  })
})

describe('useStoredSidebarWorkspaceState', () => {
  it('composes stored sidebar UI, selection, editing, and supplied sort state', () => {
    const folderId = testId<'sidebarItems'>('folder_1')
    const noteId = testId<'sidebarItems'>('note_1')
    const sort = { options: DEFAULT_SORT_OPTIONS, setOptions: () => {} }
    const sidebar = createSidebarWorkspaceStateHarness({ sort, workspaceId })

    act(() => {
      sidebar.current.uiCommands.setFolderState(folderId, true)
      sidebar.current.editing.setRenamingItemId(noteId)
      sidebar.current.selectionCommands.selectSingleItem(noteId)
    })

    expect(sidebar.current.ui.folderStates[folderId]).toBe(true)
    expect(sidebar.current.sort).toBe(sort)
    expect(sidebar.current.editing.renamingItemId).toBe(noteId)
    expect(sidebar.current.selection.selectedItemIds).toEqual([noteId])
    expect(sidebar.current.selectionCommands.getSelectionSnapshot()).toEqual({
      selectedItemIds: [noteId],
      anchorItemId: noteId,
      focusedItemId: noteId,
      activeItemSurface: null,
    })
  })

  it('keeps composed state and command wrappers stable across unchanged rerenders', () => {
    const sort = { options: DEFAULT_SORT_OPTIONS, setOptions: () => {} }
    const hook = renderHook(() =>
      useRuntimeSidebarWorkspaceStateWithSort({ workspace: { id: workspaceId } }, sort),
    )
    const initialState = hook.result.current
    const initialUiCommands = initialState.uiCommands
    const initialEditing = initialState.editing
    const initialSelectionCommands = initialState.selectionCommands

    hook.rerender()

    expect(hook.result.current).toBe(initialState)
    expect(hook.result.current.uiCommands).toBe(initialUiCommands)
    expect(hook.result.current.editing).toBe(initialEditing)
    expect(hook.result.current.selectionCommands).toBe(initialSelectionCommands)
  })
})

describe('useRuntimeSidebarWorkspaceState', () => {
  it('isolates transient state for mounted runtime instances with the same workspace id', () => {
    const firstRuntime = { workspace: { id: 'demo-campaign', instanceId: 'demo-runtime-a' } }
    const secondRuntime = { workspace: { id: 'demo-campaign', instanceId: 'demo-runtime-b' } }
    const firstNoteId = testId<'sidebarItems'>('note_a')
    const secondNoteId = testId<'sidebarItems'>('note_b')
    const first = renderHook(() => useRuntimeSidebarWorkspaceState(firstRuntime))
    const second = renderHook(() => useRuntimeSidebarWorkspaceState(secondRuntime))

    act(() => {
      first.result.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [firstNoteId],
      })
      first.result.current.selectionCommands.selectSingleItem(firstNoteId)
      second.result.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [secondNoteId],
      })
      second.result.current.selectionCommands.selectSingleItem(secondNoteId)
    })

    expect(first.result.current.selection.selectedItemIds).toEqual([firstNoteId])
    expect(second.result.current.selection.selectedItemIds).toEqual([secondNoteId])
  })

  it('removes transient runtime instance state on unmount', () => {
    const runtime = { workspace: { id: 'demo-campaign', instanceId: 'demo-runtime-a' } }
    const folderId = testId<'sidebarItems'>('folder_1')
    const first = renderHook(() => useRuntimeSidebarWorkspaceState(runtime))

    act(() => {
      first.result.current.uiCommands.setFolderState(folderId, true)
    })
    expect(first.result.current.ui.folderStates[folderId]).toBe(true)

    first.unmount()

    const second = renderHook(() => useRuntimeSidebarWorkspaceState(runtime))
    expect(second.result.current.ui.folderStates[folderId]).toBeUndefined()
  })
})
